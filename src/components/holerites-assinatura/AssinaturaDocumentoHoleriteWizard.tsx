import { useEffect, useState } from "react";
import { Check, Download, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SignatureCanvas from "@/components/forms/SignatureCanvas";
import { SelfieCapture } from "./SelfieCapture";

interface Documento {
  id: string;
  mes: number;
  ano: number;
  arquivo_nome: string;
  arquivo_path: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: Documento;
  onSigned?: () => void;
}

export function AssinaturaDocumentoHoleriteWizard({ open, onOpenChange, documento, onSigned }: Props) {
  const [step, setStep] = useState(0);
  const [aceite, setAceite] = useState(false);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoConsent, setGeoConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setAceite(false);
    setSelfie(null);
    setGeo(null);
    setGeoConsent(false);
    setResult(null);
  }, [open]);

  async function requestGeo() {
    if (!navigator.geolocation) return null;
    return new Promise<{ lat: number; lng: number } | null>((resolve) => navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { timeout: 8000 },
    ));
  }

  async function sign(signature: string) {
    if (!selfie) return toast.error("Faltam dados para assinar");
    setSubmitting(true);
    try {
      const ua = navigator.userAgent;
      const { data, error } = await supabase.functions.invoke("holerite-documento-assinar", { body: {
        documento_id: documento.id,
        selfie_base64: selfie,
        assinatura_base64: signature,
        geo: geo ? { ...geo, consentimento: geoConsent } : null,
        user_agent: ua,
        navegador: /firefox/i.test(ua) ? "Firefox" : /edg/i.test(ua) ? "Edge" : /chrome/i.test(ua) ? "Chrome" : /safari/i.test(ua) ? "Safari" : "Outro",
        sistema_operacional: /windows/i.test(ua) ? "Windows" : /android/i.test(ua) ? "Android" : /iphone|ipad/i.test(ua) ? "iOS" : /mac os/i.test(ua) ? "macOS" : "Outro",
      } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      setStep(4);
      toast.success("Holerite assinado com sucesso!");
      onSigned?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao assinar holerite");
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadSigned() {
    const path = result?.pdf_path;
    if (!path) return toast.error("PDF assinado indisponível");
    const nome = `holerite-${String(documento.mes).padStart(2, "0")}-${documento.ano}.pdf`;
    const { data, error } = await supabase.storage.from("holerites-assinados").createSignedUrl(path, 300, { download: nome });
    if (error || !data?.signedUrl) return toast.error("Não foi possível baixar o holerite");
    window.location.href = data.signedUrl;
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle>Assinatura do holerite</DialogTitle></DialogHeader>
      {step === 0 && <div className="space-y-4">
        <p className="text-sm">Confirme o recebimento do holerite de {String(documento.mes).padStart(2, "0")}/{documento.ano}. O PDF será liberado após a assinatura digital.</p>
        <label className="flex items-start gap-2"><Checkbox checked={aceite} onCheckedChange={(value) => setAceite(!!value)} /><span className="text-sm">Confirmo que desejo assinar digitalmente este holerite.</span></label>
        <label className="flex items-start gap-2"><Checkbox checked={geoConsent} onCheckedChange={async (value) => { setGeoConsent(!!value); if (value) { const location = await requestGeo(); setGeo(location); if (!location) setGeoConsent(false); } else setGeo(null); }} /><span className="flex items-center gap-1 text-sm"><MapPin className="h-4 w-4" /> Registrar minha localização (opcional)</span></label>
        <div className="flex justify-end"><Button disabled={!aceite} onClick={() => setStep(2)}>Continuar</Button></div>
      </div>}
      {step === 2 && <SelfieCapture onCapture={(value) => { setSelfie(value); setStep(3); }} onCancel={() => setStep(0)} />}
      {step === 3 && <div className="space-y-3"><SignatureCanvas title="Sua assinatura" onSave={sign} onCancel={() => setStep(2)} />{submitting && <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Registrando assinatura...</p>}</div>}
      {step === 4 && result && <div className="space-y-4">
        <div className="rounded border border-green-200 bg-green-50 p-4"><p className="flex items-center gap-2 font-semibold text-green-800"><Check className="h-5 w-5" /> Holerite assinado com sucesso!</p><p className="mt-2 text-sm"><strong>Protocolo:</strong> {result.protocolo}</p></div>
        <div className="flex justify-between"><Button variant="outline" onClick={() => void downloadSigned()}><Download className="mr-2 h-4 w-4" /> Baixar holerite</Button><Button onClick={() => onOpenChange(false)}>Fechar</Button></div>
      </div>}
    </DialogContent>
  </Dialog>;
}
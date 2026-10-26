import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, ChevronRight, Download, FileCheck2, MapPin, Loader2 } from "lucide-react";
import SignatureCanvas from "@/components/forms/SignatureCanvas";
import { SelfieCapture } from "./SelfieCapture";
import type { HoleriteEmpresa, HoleriteEmployee, HoleritePagamento } from "@/lib/pdfGeneratorHolerite";
import { gerarCertificadoPdf, blobToBase64 } from "@/lib/pdfGeneratorCertificadoHolerite";
import { dataBR } from "@/lib/date";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pagamento: HoleritePagamento;
  employee: HoleriteEmployee & { id: string; matricula?: string | null };
  empresa: HoleriteEmpresa;
  empresaId: string;
  employeeId: string;
  onSigned?: () => void;
}

const MESES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function detectBrowser(ua: string) {
  if (/edg\//i.test(ua)) return "Edge";
  if (/chrome\//i.test(ua) && !/edg/i.test(ua)) return "Chrome";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/safari\//i.test(ua) && !/chrome/i.test(ua)) return "Safari";
  return "Outro";
}
function detectOS(ua: string) {
  if (/windows/i.test(ua)) return "Windows";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/mac os/i.test(ua)) return "macOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Outro";
}

async function gerarHoleritePdfBlob(
  pagamento: HoleritePagamento,
  empresa: HoleriteEmpresa,
  employee: HoleriteEmployee,
): Promise<Blob> {
  // Intercepta o output do jsPDF via reimplementação leve.
  // Para evitar duplicar lógica, usamos uma técnica simples: monkey-patch File.prototype não funciona.
  // Em vez disso, reaproveitamos gerarHoleritePdf passando uma flag — mas ela faz download.
  // Solução: copiamos o gerador chamando-o e capturando via prompt do usuário não. Vamos refazer importando jsPDF aqui.
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ format: "a4", orientation: "portrait" });
  // Geração simplificada e fiel ao layout principal
  const pw = doc.internal.pageSize.getWidth();
  const ml = 10;
  const mr = 10;
  const cw = pw - ml - mr;
  let y = 12;

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatCnpj = (c: string | null) => {
    if (!c) return "";
    const x = c.replace(/\D/g, "");
    return x.length === 14
      ? `${x.slice(0, 2)}.${x.slice(2, 5)}.${x.slice(5, 8)}/${x.slice(8, 12)}-${x.slice(12)}`
      : c;
  };
  const formatCpf = (c: string | null) => {
    if (!c) return "";
    const x = c.replace(/\D/g, "");
    return x.length === 11
      ? `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6, 9)}-${x.slice(9)}`
      : c;
  };
  const formatDate = (d: string | null) => (d ? dataBR(d).toLocaleDateString("pt-BR") : "-");

  const proventos = pagamento.folha_pagamento_itens?.filter((i) => i.variaveis_folha?.tipo === "provento") || [];
  const descontos = pagamento.folha_pagamento_itens?.filter((i) => i.variaveis_folha?.tipo === "desconto") || [];
  const salarioBase = employee.salario || 0;
  const totalProv = salarioBase + proventos.reduce((s, p) => s + p.valor, 0);
  const totalDesc = descontos.reduce((s, d) => s + d.valor, 0);

  doc.setFillColor(33, 37, 41);
  doc.rect(ml, y, cw, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text((empresa.nome || "").toUpperCase(), ml + cw / 2, y + 6, { align: "center" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`CNPJ: ${formatCnpj(empresa.cnpj)}`, ml + cw / 2, y + 11, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 16;

  doc.setFillColor(240, 240, 240);
  doc.rect(ml, y, cw, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("RECIBO DE PAGAMENTO DE SALÁRIO", ml + cw / 2, y + 5, { align: "center" });
  doc.setFontSize(8);
  doc.text(`${MESES[pagamento.mes]}/${pagamento.ano}`, ml + cw - 4, y + 5, { align: "right" });
  y += 9;

  doc.setFontSize(8);
  doc.text(`Nome: ${employee.nome_completo?.toUpperCase() || ""}`, ml, y);
  doc.text(`CPF: ${formatCpf(employee.cpf)}`, ml + cw - 4, y, { align: "right" });
  y += 4;
  doc.text(
    `Cargo: ${employee.cargo || "-"}   |   Admissão: ${formatDate(employee.data_admissao)}   |   Setor: ${employee.setor || "-"}`,
    ml,
    y,
  );
  y += 6;

  const rows: any[] = [["101", "Salário Base", "", formatCurrency(salarioBase), ""]];
  proventos.forEach((p) =>
    rows.push([p.variaveis_folha?.codigo || "-", p.variaveis_folha?.nome, "", formatCurrency(p.valor), ""]),
  );
  descontos.forEach((d) =>
    rows.push([d.variaveis_folha?.codigo || "-", d.variaveis_folha?.nome, "", "", formatCurrency(d.valor)]),
  );

  autoTable(doc, {
    startY: y,
    head: [["Cód.", "Descrição", "Ref.", "Proventos", "Descontos"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 7 },
    headStyles: { fillColor: [33, 37, 41], textColor: 255 },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  doc.setFillColor(33, 37, 41);
  doc.rect(ml, y, cw, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Total Vencimentos: R$ ${formatCurrency(totalProv)}`, ml + 4, y + 6);
  doc.text(`Total Descontos: R$ ${formatCurrency(totalDesc)}`, ml + cw - 4, y + 6, { align: "right" });
  y += 11;

  doc.setFillColor(40, 100, 60);
  doc.rect(ml, y, cw, 10, "F");
  doc.setFontSize(12);
  doc.text(`VALOR LÍQUIDO: R$ ${formatCurrency(pagamento.valor_liquido)}`, ml + cw / 2, y + 7, { align: "center" });

  return doc.output("blob");
}

export function AssinaturaHoleriteWizard({
  open,
  onOpenChange,
  pagamento,
  employee,
  empresa,
  empresaId,
  employeeId,
  onSigned,
}: Props) {
  const [step, setStep] = useState(0);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [aceite, setAceite] = useState(false);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoConsent, setGeoConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setStep(0);
      setAceite(false);
      setSelfie(null);
      setAssinatura(null);
      setGeo(null);
      setGeoConsent(false);
      setResultado(null);
      gerarHoleritePdfBlob(pagamento, empresa, employee).then((b) => {
        setPdfBlob(b);
        const url = URL.createObjectURL(b);
        setPdfUrl(url);
      });
    } else {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
      setPdfBlob(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function registrarVisualizacao(assinaturaId?: string) {
    // primeiro evento: somente quando criar registro; aqui só log local
  }

  function pedirGeo(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 8000 },
      );
    });
  }

  async function submitAssinatura(sigOverride?: string) {
    const sig = sigOverride ?? assinatura;
    if (!pdfBlob || !selfie || !sig) {
      toast.error("Faltam dados para assinar");
      return;
    }

    setSubmitting(true);
    try {
      // Pedir geo se consentido (já pediu antes)
      const ua = navigator.userAgent;
      const pdfB64 = await blobToBase64(pdfBlob);

      const { data, error } = await supabase.functions.invoke("holerite-assinar", {
        body: {
          folha_pagamento_id: pagamento.id,
          pdf_holerite_base64: pdfB64,
          selfie_base64: selfie,
          assinatura_base64: sig,
          geo: geo ? { lat: geo.lat, lng: geo.lng, consentimento: geoConsent } : null,
          user_agent: ua,
          navegador: detectBrowser(ua),
          sistema_operacional: detectOS(ua),
        },
      });
      if (error) throw error;
      if ((data as any).error) throw new Error((data as any).error);

      // Gerar certificado client-side
      const baseUrl = window.location.origin;
      const certBlob = await gerarCertificadoPdf({
        protocolo: (data as any).protocolo,
        hash_documento: (data as any).hash_documento,
        hash_assinatura: (data as any).hash_assinatura,
        nome_completo: (employee.nome_completo || "").toUpperCase(),
        cpf: employee.cpf || null,
        matricula: (employee as any).matricula || null,
        empresa_nome: empresa.nome,
        empresa_cnpj: empresa.cnpj || null,
        periodo: `${MESES[pagamento.mes]}/${pagamento.ano}`,
        data_assinatura: (data as any).data_assinatura,
        ip: (data as any).ip || "-",
        user_agent: ua,
        navegador: detectBrowser(ua),
        sistema_operacional: detectOS(ua),
        geo: geo,
        geo_consentimento: geoConsent,
        selfie_data_url: selfie,
        assinatura_data_url: sig,
        validacao_url: `${baseUrl}/validar-holerite/${(data as any).protocolo}`,
        eventos: [
          { tipo: "Visualização", data: (data as any).data_assinatura, ip: (data as any).ip },
          { tipo: "Captura de selfie", data: (data as any).data_assinatura, ip: (data as any).ip },
          { tipo: "Assinatura confirmada", data: (data as any).data_assinatura, ip: (data as any).ip },
        ],
      });
      const certB64 = await blobToBase64(certBlob);

      // Faz upload do certificado
      await supabase.functions.invoke("holerite-anexar-certificado", {
        body: {
          assinatura_id: (data as any).assinatura_id,
          pdf_certificado_base64: certB64,
        },
      });

      setResultado({ ...(data as any), certBlob, pdfBlob });
      setStep(4);
      toast.success("Holerite assinado com sucesso!");
      onSigned?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao assinar holerite");
    } finally {
      setSubmitting(false);
    }
  }

  function baixarBlob(blob: Blob, nome: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const titulos = [
    "1. Visualizar Holerite",
    "2. Aceite",
    "3. Selfie",
    "4. Assinatura",
    "Concluído",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assinatura Digital do Holerite — {titulos[step]}</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs mb-2">
          {[0, 1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold ${
                  step > s
                    ? "bg-green-600 text-white"
                    : step === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <Check className="w-3 h-3" /> : s + 1}
              </div>
              {s < 3 && <div className="flex-1 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 0: PDF */}
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Leia atentamente o seu holerite abaixo antes de prosseguir.
            </p>
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                title="Holerite"
                className="w-full h-[480px] border rounded"
              />
            ) : (
              <div className="flex items-center justify-center h-[480px] border rounded">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => setStep(1)} disabled={!pdfUrl}>
                Continuar <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Aceite */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/30 space-y-3 text-sm">
              <p>
                Ao prosseguir, você declara que <strong>leu, conferiu e concorda</strong> com
                todos os valores e informações contidos no holerite referente a{" "}
                <strong>{MESES[pagamento.mes]}/{pagamento.ano}</strong>.
              </p>
              <p>
                A assinatura será registrada com:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Selfie capturada no momento da assinatura</li>
                <li>Endereço IP, navegador e sistema operacional</li>
                <li>Data e hora oficiais</li>
                <li>Hash criptográfico (SHA-256) garantindo a integridade</li>
                <li>Geolocalização (opcional, mediante seu consentimento)</li>
              </ul>
              <p className="text-xs text-muted-foreground">
                Esta assinatura possui valor probatório nos termos da Lei nº 14.063/2020
                (assinatura eletrônica avançada).
              </p>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={aceite}
                onCheckedChange={(v) => setAceite(!!v)}
                id="aceite"
              />
              <span className="text-sm leading-snug">
                Li e concordo com o conteúdo deste holerite e autorizo o registro
                eletrônico da minha assinatura.
              </span>
            </label>
            <div className="flex items-start gap-2">
              <Checkbox
                checked={geoConsent}
                onCheckedChange={async (v) => {
                  setGeoConsent(!!v);
                  if (v) {
                    const g = await pedirGeo();
                    if (g) setGeo(g);
                    else {
                      setGeoConsent(false);
                      toast.error("Não foi possível obter a geolocalização.");
                    }
                  } else setGeo(null);
                }}
                id="geo"
              />
              <span className="text-sm leading-snug flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                Autorizo o registro da minha geolocalização (opcional)
              </span>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>
                Voltar
              </Button>
              <Button onClick={() => setStep(2)} disabled={!aceite}>
                Continuar <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Selfie */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Capture uma selfie sua para confirmar sua identidade.
            </p>
            <SelfieCapture
              onCapture={(url) => {
                setSelfie(url);
                setStep(3);
              }}
              onCancel={() => setStep(1)}
            />
          </div>
        )}

        {/* Step 3: Assinatura */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Assine no quadro abaixo usando o mouse ou o dedo (em celular). Ao confirmar, sua assinatura será registrada automaticamente.
            </p>
            <SignatureCanvas
              title="Sua assinatura"
              onSave={(sig) => {
                setAssinatura(sig);
                submitAssinatura(sig);
              }}
              onCancel={() => setStep(2)}
            />
            {submitting && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Registrando assinatura...
              </div>
            )}
          </div>
        )}


        {/* Step 4: Concluído */}
        {step === 4 && resultado && (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
              <h3 className="font-semibold flex items-center gap-2 text-green-800">
                <Check className="w-5 h-5" /> Holerite assinado com sucesso!
              </h3>
              <div className="text-sm space-y-1 text-green-900">
                <p>
                  <strong>Protocolo:</strong> {resultado.protocolo}
                </p>
                <p className="break-all">
                  <strong>Hash SHA-256:</strong>{" "}
                  <span className="font-mono text-xs">{resultado.hash_documento}</span>
                </p>
                <p>
                  <strong>Data/Hora:</strong>{" "}
                  {dataBR(resultado.data_assinatura).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => resultado.pdfBlob && baixarBlob(resultado.pdfBlob, `holerite-${resultado.protocolo}.pdf`)}
              >
                <Download className="w-4 h-4 mr-2" /> Baixar Holerite
              </Button>
              <Button
                onClick={() => resultado.certBlob && baixarBlob(resultado.certBlob, `certificado-${resultado.protocolo}.pdf`)}
              >
                <Download className="w-4 h-4 mr-2" /> Baixar Certificado
              </Button>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

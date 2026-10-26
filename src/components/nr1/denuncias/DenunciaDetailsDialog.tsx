import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { STATUS_DENUNCIA } from "@/lib/nr1/perguntasPadrao";
import { toast } from "sonner";
import { Paperclip, Loader2 } from "lucide-react";
import { dataBR } from "@/lib/date";

interface Props {
  denuncia: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUpdated: () => void;
}

export function DenunciaDetailsDialog({ denuncia, open, onOpenChange, onUpdated }: Props) {
  const [anexos, setAnexos] = useState<any[]>([]);
  const [apuracoes, setApuracoes] = useState<any[]>([]);
  const [status, setStatus] = useState(denuncia?.status || "recebida");
  const [novaNota, setNovaNota] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!denuncia?.id) return;
    setStatus(denuncia.status);
    (async () => {
      const [aRes, apRes] = await Promise.all([
        (supabase.from("nr1_denuncias_anexos") as any).select("*").eq("denuncia_id", denuncia.id),
        (supabase.from("nr1_denuncias_apuracao") as any).select("*").eq("denuncia_id", denuncia.id).order("created_at"),
      ]);
      setAnexos(aRes.data || []);
      setApuracoes(apRes.data || []);
    })();
  }, [denuncia]);

  const updateStatus = async (s: string) => {
    setStatus(s);
    await (supabase.from("nr1_denuncias") as any).update({ status: s }).eq("id", denuncia.id);
    onUpdated();
  };

  const addApuracao = async () => {
    if (!novaNota.trim()) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from("nr1_denuncias_apuracao") as any).insert({
      denuncia_id: denuncia.id,
      registrado_por: user?.id,
      nota: novaNota.trim(),
    });
    if (error) toast.error(error.message);
    else {
      setNovaNota("");
      const apRes = await (supabase.from("nr1_denuncias_apuracao") as any).select("*").eq("denuncia_id", denuncia.id).order("created_at");
      setApuracoes(apRes.data || []);
      toast.success("Apuração registrada");
    }
    setLoading(false);
  };

  const downloadAnexo = async (path: string) => {
    const { data } = await supabase.storage.from("nr1-denuncias").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (!denuncia) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono">{denuncia.protocolo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <p className="font-medium">{denuncia.categoria}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Setor</Label>
              <p className="font-medium">{denuncia.setor || "—"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Recebida em</Label>
              <p className="font-medium">{dataBR(denuncia.created_at).toLocaleString("pt-BR")}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={updateStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_DENUNCIA.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <Card className="p-3 bg-muted/50 whitespace-pre-wrap text-sm">{denuncia.descricao}</Card>
          </div>

          {anexos.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Anexos ({anexos.length})</Label>
              <div className="space-y-1 mt-1">
                {anexos.map((a) => (
                  <button key={a.id} onClick={() => downloadAnexo(a.file_path)} className="flex items-center gap-2 text-sm bg-muted px-3 py-2 rounded w-full hover:bg-muted/80">
                    <Paperclip className="w-4 h-4" />
                    <span className="truncate">{a.file_path.split("/").pop()}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>Registrar apuração</Label>
            <Textarea value={novaNota} onChange={(e) => setNovaNota(e.target.value)} rows={3} placeholder="Notas, evidências, próximos passos..." />
            <Button onClick={addApuracao} disabled={loading || !novaNota.trim()} className="mt-2" size="sm">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </div>

          {apuracoes.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Histórico de apuração</Label>
              <div className="space-y-2 mt-1">
                {apuracoes.map((ap) => (
                  <Card key={ap.id} className="p-3 text-sm">
                    <p className="whitespace-pre-wrap">{ap.nota}</p>
                    <p className="text-xs text-muted-foreground mt-1">{dataBR(ap.created_at).toLocaleString("pt-BR")}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

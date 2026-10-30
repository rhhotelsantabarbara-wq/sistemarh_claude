import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, ExternalLink, FileText, Loader2, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { dataBR, toISODateLocal } from "@/lib/date";

const db = supabase as any;

/** Último dia do atestado (o primeiro dia conta) */
export const fimAtestado = (inicio: string, dias: number) => {
  const d = dataBR(inicio);
  d.setDate(d.getDate() + Math.max(1, dias) - 1);
  return toISODateLocal(d);
};

/** Link temporário para ver o arquivo guardado na pasta privada */
export const abrirArquivoAtestado = async (path: string) => {
  const janela = window.open("", "_blank");
  const { data, error } = await supabase.storage.from("atestados").createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) { janela?.close(); toast.error("Não foi possível abrir o arquivo"); return; }
  if (janela) janela.location.href = data.signedUrl; else window.location.href = data.signedUrl;
};

const AtestadosRecebidos = ({ onAprovado }: { onAprovado?: () => void }) => {
  const qc = useQueryClient();
  const [analisando, setAnalisando] = useState<any | null>(null);
  const [acao, setAcao] = useState<"aprovar" | "recusar">("aprovar");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [motivo, setMotivo] = useState("");
  const [cid, setCid] = useState("");
  const [resposta, setResposta] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [previas, setPrevias] = useState<Record<string, string>>({});

  const { data: pendentes = [], isLoading } = useQuery({
    queryKey: ["atestados-pendentes"],
    queryFn: async () => {
      const { data, error } = await db.from("atestados_enviados").select("*, employees(nome_completo, cargo, setor)").eq("status", "pendente").order("created_at");
      if (error) throw error;
      const lista = data || [];
      const imagens = lista.filter((a: any) => !a.arquivo_path.toLowerCase().endsWith(".pdf"));
      if (imagens.length) {
        const { data: urls } = await supabase.storage.from("atestados").createSignedUrls(imagens.map((a: any) => a.arquivo_path), 60 * 30);
        const m: Record<string, string> = {};
        (urls || []).forEach((u: any) => { if (u.path && u.signedUrl) m[u.path] = u.signedUrl; });
        setPrevias(m);
      }
      return lista;
    },
  });

  const abrir = (a: any, qual: "aprovar" | "recusar") => {
    setAnalisando(a); setAcao(qual);
    setInicio(a.data_inicio); setFim(fimAtestado(a.data_inicio, a.dias));
    setMotivo([a.tipo, a.observacao].filter(Boolean).join(" - ")); setCid(""); setResposta("");
  };

  const confirmar = async () => {
    if (!analisando) return;
    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (acao === "aprovar") {
        if (!inicio || !fim || fim < inicio) throw new Error("Confira as datas");
        const { data: af, error } = await supabase.from("afastamentos").insert({
          employee_id: analisando.employee_id,
          data_inicio: inicio,
          data_fim: fim,
          motivo: motivo.trim() || analisando.tipo,
          cid: cid.trim() || null,
          documento_url: `storage:atestados/${analisando.arquivo_path}`,
          created_by: user?.id,
        }).select("id").single();
        if (error) throw error;
        const up = await db.from("atestados_enviados").update({
          status: "aprovado", afastamento_id: af.id, cid: cid.trim() || null, resposta_rh: resposta.trim() || null,
          analisado_por: user?.id, analisado_em: new Date().toISOString(),
        }).eq("id", analisando.id);
        if (up.error) throw up.error;
        toast.success("Atestado aprovado e lançado em afastamentos");
        onAprovado?.();
      } else {
        if (!resposta.trim()) throw new Error("Escreva o motivo da recusa para o colaborador");
        const { error } = await db.from("atestados_enviados").update({
          status: "recusado", resposta_rh: resposta.trim(), analisado_por: user?.id, analisado_em: new Date().toISOString(),
        }).eq("id", analisando.id);
        if (error) throw error;
        toast.success("Atestado recusado. O colaborador vê o motivo no portal.");
      }
      setAnalisando(null);
      qc.invalidateQueries({ queryKey: ["atestados-pendentes"] });
      qc.invalidateQueries({ queryKey: ["documentos-vencendo"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  if (isLoading || pendentes.length === 0) return null;

  return (
    <Card className="border-amber-300 dark:border-amber-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-5 w-5 text-amber-600" />
          Atestados enviados pelo celular
          <Badge variant="destructive">{pendentes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {pendentes.map((a: any) => {
          const previa = previas[a.arquivo_path];
          return (
            <div key={a.id} className="flex gap-3 rounded-lg border bg-card p-3">
              <button type="button" onClick={() => abrirArquivoAtestado(a.arquivo_path)} className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted" aria-label="Ver atestado">
                {previa ? <img src={previa} alt="" className="h-full w-full object-cover" /> : <FileText className="h-8 w-8 text-muted-foreground" />}
              </button>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate font-semibold">{a.employees?.nome_completo}</p>
                <p className="text-sm">{a.tipo} · <b>{a.dias} {a.dias === 1 ? "dia" : "dias"}</b> a partir de {dataBR(a.data_inicio).toLocaleDateString("pt-BR")}</p>
                {a.observacao && <p className="text-xs text-muted-foreground break-words">“{a.observacao}”</p>}
                <p className="text-xs text-muted-foreground">Enviado em {new Date(a.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" onClick={() => abrir(a, "aprovar")}><Check className="mr-1 h-4 w-4" />Aprovar</Button>
                  <Button size="sm" variant="outline" onClick={() => abrir(a, "recusar")}><X className="mr-1 h-4 w-4" />Recusar</Button>
                  <Button size="sm" variant="ghost" onClick={() => abrirArquivoAtestado(a.arquivo_path)}><ExternalLink className="mr-1 h-4 w-4" />Ver</Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>

      <Dialog open={!!analisando} onOpenChange={(o) => !o && setAnalisando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{acao === "aprovar" ? "Aprovar atestado" : "Recusar atestado"}</DialogTitle>
            <DialogDescription>{analisando?.employees?.nome_completo}</DialogDescription>
          </DialogHeader>
          {acao === "aprovar" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="ap-ini" className="mb-1.5 block">Início</Label><Input id="ap-ini" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
                <div><Label htmlFor="ap-fim" className="mb-1.5 block">Fim</Label><Input id="ap-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
              </div>
              <div><Label htmlFor="ap-mot" className="mb-1.5 block">Motivo</Label><Input id="ap-mot" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
              <div><Label htmlFor="ap-cid" className="mb-1.5 block">CID (se tiver no atestado)</Label><Input id="ap-cid" value={cid} onChange={(e) => setCid(e.target.value.toUpperCase())} placeholder="Ex.: J11" /></div>
              <div><Label htmlFor="ap-resp" className="mb-1.5 block">Mensagem para o colaborador (opcional)</Label><Textarea id="ap-resp" rows={2} value={resposta} onChange={(e) => setResposta(e.target.value)} /></div>
              <p className="text-xs text-muted-foreground">Ao aprovar, o atestado é lançado em Afastamentos com o arquivo anexado.</p>
            </div>
          ) : (
            <div>
              <Label htmlFor="rc-resp" className="mb-1.5 block">Motivo da recusa (o colaborador vê no portal) *</Label>
              <Textarea id="rc-resp" rows={3} value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="Ex.: foto ilegível, envie de novo com o documento inteiro" />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAnalisando(null)}>Cancelar</Button>
            <Button variant={acao === "recusar" ? "destructive" : "default"} onClick={confirmar} disabled={salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{acao === "aprovar" ? "Aprovar e lançar" : "Recusar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AtestadosRecebidos;

/** Abre ou baixa o documento de um afastamento (link comum ou arquivo da pasta privada de atestados) */
export const abrirDocumentoAfastamento = async (url: string, baixar = false) => {
  if (!url.startsWith("storage:atestados/")) {
    if (baixar) { const a = document.createElement("a"); a.href = url; a.download = "atestado"; a.click(); }
    else window.open(url, "_blank");
    return;
  }
  const path = url.replace("storage:atestados/", "");
  if (!baixar) return abrirArquivoAtestado(path);
  const { data, error } = await supabase.storage.from("atestados").createSignedUrl(path, 600, { download: true });
  if (error || !data?.signedUrl) return toast.error("Não foi possível baixar o arquivo");
  window.location.href = data.signedUrl;
};

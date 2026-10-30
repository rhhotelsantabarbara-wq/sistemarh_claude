import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, CheckCircle2, Clock, FileImage, Loader2, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { todayISO, dataBR } from "@/lib/date";

const db = supabase as any;
export const TIPOS_ATESTADO = ["Atestado médico", "Atestado odontológico", "Declaração de comparecimento", "Acompanhamento de familiar", "Outro"];

/** Diminui fotos grandes do celular antes de enviar */
const comprimir = async (arquivo: File): Promise<Blob> => {
  if (!arquivo.type.startsWith("image/") || arquivo.size < 900 * 1024) return arquivo;
  try {
    const bmp = await createImageBitmap(arquivo);
    const escala = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * escala);
    c.height = Math.round(bmp.height * escala);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    return blob && blob.size < arquivo.size ? blob : arquivo;
  } catch {
    return arquivo;
  }
};

const STATUS = {
  pendente: { rotulo: "Em análise", icone: Clock, cor: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200" },
  aprovado: { rotulo: "Recebido pelo RH", icone: CheckCircle2, cor: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200" },
  recusado: { rotulo: "Recusado", icone: XCircle, cor: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200" },
} as const;

const EnviarAtestado = ({ employeeId, somenteLeitura }: { employeeId: string; somenteLeitura?: boolean }) => {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState(todayISO());
  const [dias, setDias] = useState("1");
  const [tipo, setTipo] = useState(TIPOS_ATESTADO[0]);
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);

  const { data: meus = [] } = useQuery({
    queryKey: ["meus-atestados", employeeId],
    queryFn: async () => {
      const { data } = await db.from("atestados_enviados").select("*").eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(20);
      return data || [];
    },
  });

  const escolher = (f?: File) => {
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) return toast.error("Arquivo muito grande");
    setArquivo(f);
    setPrevia(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  };

  const enviar = async () => {
    if (!arquivo) return toast.error("Tire a foto do atestado");
    const n = parseInt(dias, 10);
    if (!n || n < 1 || n > 365) return toast.error("Informe quantos dias de afastamento");
    if (!dataInicio) return toast.error("Informe a data do atestado");
    setEnviando(true);
    try {
      const blob = await comprimir(arquivo);
      const ext = blob.type === "image/jpeg" ? "jpg" : (arquivo.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${employeeId}/${Date.now()}.${ext}`;
      if (blob.size > 10 * 1024 * 1024) throw new Error("Arquivo muito grande (máx. 10 MB). Tire uma foto em vez de enviar o arquivo.");
      const up = await supabase.storage.from("atestados").upload(path, blob, { contentType: blob.type || arquivo.type || undefined });
      if (up.error) throw up.error;
      const { error } = await db.from("atestados_enviados").insert({
        employee_id: employeeId, data_inicio: dataInicio, dias: n, tipo, observacao: observacao.trim() || null, arquivo_path: path,
      });
      if (error) throw error;
      toast.success("Atestado enviado! O RH vai conferir.");
      setArquivo(null); setPrevia(null); setDias("1"); setObservacao(""); setDataInicio(todayISO()); setTipo(TIPOS_ATESTADO[0]);
      if (inputRef.current) inputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["meus-atestados", employeeId] });
    } catch (e: any) {
      toast.error(e.message || "Não foi possível enviar");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-5">
      {!somenteLeitura && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => escolher(e.target.files?.[0])} />
            <button type="button" onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed bg-muted/40 p-4 text-center transition hover:border-primary/50">
              {previa ? (
                <img src={previa} alt="Prévia do atestado" className="max-h-64 rounded-lg object-contain" />
              ) : arquivo ? (
                <><FileImage className="h-8 w-8 text-primary" /><span className="text-sm font-medium break-all">{arquivo.name}</span></>
              ) : (
                <><Camera className="h-10 w-10 text-primary" /><span className="font-semibold">Tirar foto do atestado</span><span className="text-xs text-muted-foreground">Foto nítida, com o documento inteiro aparecendo</span></>
              )}
              {arquivo && <span className="text-xs text-primary">Toque para trocar a foto</span>}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="at-data" className="mb-1.5 block">Data do atestado</Label>
                <Input id="at-data" type="date" value={dataInicio} max={todayISO()} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="at-dias" className="mb-1.5 block">Dias de afastamento</Label>
                <Input id="at-dias" type="number" inputMode="numeric" min={1} max={365} value={dias} onChange={(e) => setDias(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="at-tipo" className="mb-1.5 block">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger id="at-tipo"><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_ATESTADO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="at-obs" className="mb-1.5 block">Observação (opcional)</Label>
              <Textarea id="at-obs" rows={2} maxLength={500} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: atestado de meio período" />
            </div>
            <Button className="h-12 w-full" onClick={enviar} disabled={enviando}>
              {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {enviando ? "Enviando…" : "Enviar para o RH"}
            </Button>
          </CardContent>
        </Card>
      )}

      <section className="space-y-2">
        <h3 className="font-semibold">Atestados enviados</h3>
        {meus.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum atestado enviado ainda.</p>
        ) : meus.map((a: any) => {
          const st = STATUS[a.status as keyof typeof STATUS] || STATUS.pendente;
          return (
            <Card key={a.id}><CardContent className="space-y-1 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{a.tipo}</p>
                  <p className="text-sm text-muted-foreground">{dataBR(a.data_inicio).toLocaleDateString("pt-BR")} · {a.dias} {a.dias === 1 ? "dia" : "dias"}</p>
                </div>
                <Badge variant="outline" className={`shrink-0 gap-1 font-normal ${st.cor}`}><st.icone className="h-3 w-3" />{st.rotulo}</Badge>
              </div>
              {a.resposta_rh && <p className="text-sm"><span className="text-muted-foreground">RH: </span>{a.resposta_rh}</p>}
            </CardContent></Card>
          );
        })}
      </section>
    </div>
  );
};

export default EnviarAtestado;

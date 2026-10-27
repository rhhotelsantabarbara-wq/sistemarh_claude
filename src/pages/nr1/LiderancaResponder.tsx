import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PERGUNTAS_LIDERANCA } from "./Lideranca";
import { Star, CheckCircle2, ShieldCheck, ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";

type Estado = "validando" | "escolher" | "responder" | "invalido" | "encerrada" | "enviado";

// Marca neste aparelho que a pessoa já avaliou aquele líder (não vai para o servidor)
const chaveAparelho = (codigo: string, lider: string) => `lideranca:${codigo}:${lider}`;
const jaRespondeu = (codigo: string, lider: string) => { try { return localStorage.getItem(chaveAparelho(codigo, lider)) === "1"; } catch { return false; } };
const marcarRespondido = (codigo: string, lider: string) => { try { localStorage.setItem(chaveAparelho(codigo, lider), "1"); } catch { /* sem armazenamento */ } };

export default function NR1LiderancaResponder() {
  const { token } = useParams();
  const [estado, setEstado] = useState<Estado>("validando");
  const [modoAntigo, setModoAntigo] = useState(false); // links individuais criados antes do link único
  const [titulo, setTitulo] = useState("");
  const [lideres, setLideres] = useState<any[]>([]);
  const [lider, setLider] = useState<any | null>(null);
  const [busca, setBusca] = useState("");
  const [valores, setValores] = useState<Record<string, number>>({});
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) return setEstado("invalido");
      const { data } = await (supabase.rpc as any)("nr1_lideranca_abrir", { p_codigo: token });
      if (data && !data.erro) {
        setTitulo(data.titulo);
        setLideres(data.lideres || []);
        if ((data.lideres || []).length === 1) { setLider(data.lideres[0]); setEstado("responder"); }
        else setEstado("escolher");
        return;
      }
      if (data?.erro === "encerrada" || data?.erro === "nao_iniciada") { setTitulo(data.titulo || ""); return setEstado("encerrada"); }
      // Compatibilidade: link individual antigo
      const { data: p } = await (supabase.rpc as any)("nr1_validar_token", { p_tipo: "lideranca", p_token: token });
      if (!p) return setEstado("invalido");
      setModoAntigo(true); setTitulo(p.titulo); setEstado("responder");
    })();
  }, [token]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return lideres.filter((l) => !t || `${l.nome} ${l.cargo} ${l.setor}`.toLowerCase().includes(t));
  }, [lideres, busca]);

  const escolher = (l: any) => {
    setLider(l); setValores({}); setComentario(""); setEstado("responder");
    window.scrollTo({ top: 0 });
  };

  const enviar = async () => {
    const respostas = PERGUNTAS_LIDERANCA.map((q) => ({ pergunta_id: q.id, valor: valores[q.id] || 0 }));
    if (respostas.some((r) => !r.valor)) return toast.error("Responda todas as perguntas");
    setEnviando(true);
    const { error } = modoAntigo
      ? await (supabase.rpc as any)("nr1_enviar_resposta", { p_tipo: "lideranca", p_token: token, p_respostas: respostas, p_comentario: comentario || null })
      : await (supabase.rpc as any)("nr1_lideranca_responder", { p_codigo: token, p_lider: lider.id, p_respostas: respostas, p_comentario: comentario || null });
    setEnviando(false);
    if (error) return toast.error(error.message);
    if (!modoAntigo) marcarRespondido(token!, lider.id);
    setEstado("enviado");
  };

  const tela = (conteudo: React.ReactNode) => <div className="min-h-screen bg-muted/30 px-4 py-10"><div className="mx-auto max-w-2xl space-y-4">{conteudo}</div></div>;
  const cabecalho = (
    <Card className="p-6">
      <div className="mb-2 flex items-center gap-3"><Star className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">{titulo || "Avaliação de liderança"}</h1></div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0" /> Resposta 100% anônima: não pedimos seu nome e nada que identifique você é guardado.</p>
    </Card>
  );

  if (estado === "validando") return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Abrindo pesquisa…</div>;
  if (estado === "invalido") return tela(<Card className="p-8 text-center"><h2 className="mb-2 text-xl font-bold">Link inválido</h2><p className="text-muted-foreground">Confira se o link está completo ou peça um novo ao RH.</p></Card>);
  if (estado === "encerrada") return tela(<Card className="p-8 text-center"><h2 className="mb-2 text-xl font-bold">Pesquisa encerrada</h2><p className="text-muted-foreground">{titulo ? `"${titulo}" não está recebendo respostas agora.` : "Esta pesquisa não está recebendo respostas agora."}</p></Card>);

  if (estado === "enviado") return tela(
    <Card className="p-8 text-center">
      <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-emerald-600" />
      <h2 className="mb-2 text-2xl font-bold">Obrigado!</h2>
      <p className="text-muted-foreground">Sua avaliação foi enviada de forma anônima.</p>
      {!modoAntigo && lideres.length > 1 && (
        <Button variant="outline" className="mt-6" onClick={() => { setLider(null); setEstado("escolher"); }}>Avaliar outro líder</Button>
      )}
    </Card>,
  );

  if (estado === "escolher") return tela(<>
    {cabecalho}
    <Card className="p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Quem é o seu líder?</h2>
        <p className="text-sm text-muted-foreground">Escolha a pessoa que você vai avaliar.</p>
      </div>
      {lideres.length > 6 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="busca-lider" className="sr-only">Buscar líder</label>
          <Input id="busca-lider" className="pl-9" placeholder="Buscar pelo nome ou setor" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {filtrados.map((l) => {
          const feito = jaRespondeu(token!, l.id);
          return (
            <button key={l.id} type="button" disabled={feito} onClick={() => escolher(l)}
              className="flex min-h-14 items-center gap-3 rounded-lg border bg-card p-3 text-left transition hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {l.nome.split(" ").filter(Boolean).map((p: string, i: number, a: string[]) => (i === 0 || i === a.length - 1 ? p[0] : "")).join("")}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{l.nome}</span>
                <span className="block truncate text-xs text-muted-foreground">{feito ? "Você já avaliou neste aparelho" : [l.cargo, l.setor].filter((x: string) => x && x.trim()).join(" · ")}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  </>);

  // Responder
  return tela(<>
    {cabecalho}
    {lider && (
      <Card className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Você está avaliando</p>
          <p className="text-lg font-semibold">{lider.nome}</p>
        </div>
        {lideres.length > 1 && <Button variant="ghost" size="sm" onClick={() => setEstado("escolher")}><ArrowLeft className="mr-1 h-4 w-4" />Trocar</Button>}
      </Card>
    )}
    {PERGUNTAS_LIDERANCA.map((q, i) => (
      <Card key={q.id} className="p-4">
        <p className="mb-3 font-medium"><span className="mr-2 text-muted-foreground">{i + 1}.</span>{q.texto}</p>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10" role="group" aria-label={q.texto}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <Button key={n} type="button" className="h-11" variant={valores[q.id] === n ? "default" : "outline"} aria-pressed={valores[q.id] === n} onClick={() => setValores({ ...valores, [q.id]: n })}>{n}</Button>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>Discordo totalmente</span><span>Concordo totalmente</span></div>
      </Card>
    ))}
    <Card className="p-4">
      <label htmlFor="comentario-lid" className="mb-2 block font-medium">Comentário (opcional)</label>
      <Textarea id="comentario-lid" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Sugestões, elogios ou o que pode melhorar. Evite escrever coisas que identifiquem você." maxLength={2000} />
    </Card>
    <Button onClick={enviar} disabled={enviando} className="h-12 w-full" size="lg">{enviando ? "Enviando…" : "Enviar avaliação anônima"}</Button>
  </>);
}

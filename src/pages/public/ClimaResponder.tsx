import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Smile, ShieldCheck, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ClimaResponder() {
  const { token } = useParams();
  const [estado, setEstado] = useState<"validando" | "valido" | "invalido" | "enviado">("validando");
  const [pesquisa, setPesquisa] = useState<any>(null);
  const [perguntasSorteadas, setPerguntasSorteadas] = useState<any[]>([]);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) return setEstado("invalido");
      // Valida o código no servidor (os códigos não ficam mais visíveis para visitantes)
      const { data: p } = await (supabase.rpc as any)("nr1_validar_token", { p_tipo: "clima", p_token: token });
      if (!p) return setEstado("invalido");
      const todas: any[] = Array.isArray(p.perguntas) ? p.perguntas : [];
      const qtd = Math.max(1, Math.min(p.qtd_sortear || todas.length, todas.length));
      const sorteadas = [...todas].sort(() => Math.random() - 0.5).slice(0, qtd);
      setPerguntasSorteadas(sorteadas);
      setPesquisa(p); setEstado("valido");
    })();
  }, [token]);

  const enviar = async () => {
    const respostas = perguntasSorteadas.map((q) => ({ pergunta_id: q.id, valor: valores[q.id] || 0 }));
    if (respostas.some((r) => !r.valor)) return toast.error("Responda todas as perguntas");
    setEnviando(true);
    // Grava a resposta e gasta o código na mesma operação
    const { error } = await (supabase.rpc as any)("nr1_enviar_resposta", {
      p_tipo: "clima",
      p_token: token,
      p_respostas: respostas,
      p_comentario: comentario || null,
    });
    if (error) { setEnviando(false); return toast.error(error.message); }
    setEstado("enviado");
  };


  if (estado === "validando")
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Validando link...</div>;
  if (estado === "invalido")
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center shadow-elegant">
          <h2 className="text-xl font-bold mb-2">Link inválido</h2>
          <p className="text-muted-foreground">Este link já foi utilizado ou expirou.</p>
        </Card>
      </div>
    );
  if (estado === "enviado")
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center shadow-elegant">
          <CheckCircle2 className="h-16 w-16 mx-auto text-emerald-600 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Resposta enviada</h2>
          <p className="text-muted-foreground">Obrigado pela sua participação anônima.</p>
        </Card>
      </div>
    );
  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="p-6 shadow-elegant">
          <div className="flex items-center gap-3 mb-2">
            <Smile className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{pesquisa.titulo}</h1>
          </div>
          {pesquisa.descricao && <p className="text-muted-foreground mb-2">{pesquisa.descricao}</p>}
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Resposta 100% anônima. Nenhuma identificação é armazenada.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {perguntasSorteadas.length} pergunta(s) sorteada(s) para você. Avalie de 1 a 10.
          </p>
        </Card>

        {perguntasSorteadas.map((q, idx) => (
          <Card key={q.id} className="p-4">
            <p className="mb-3 font-medium">
              <span className="text-muted-foreground mr-2">{idx + 1}.</span>{q.texto}
            </p>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={valores[q.id] === n ? "default" : "outline"}
                  onClick={() => setValores({ ...valores, [q.id]: n })}
                >
                  {n}
                </Button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>1 — Péssimo</span><span>10 — Excelente</span>
            </div>
          </Card>
        ))}


        <Card className="p-4">
          <p className="mb-2 font-medium">Comentário adicional (opcional)</p>
          <Textarea value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="..." />
        </Card>

        <Button onClick={enviar} disabled={enviando} className="w-full" size="lg">
          {enviando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Enviar resposta
        </Button>
      </div>
    </div>
  );
}

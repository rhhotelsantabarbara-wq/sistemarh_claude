import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PERGUNTAS_LIDERANCA } from "./Lideranca";
import { Star, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function NR1LiderancaResponder() {
  const { token } = useParams();
  const [estado, setEstado] = useState<"validando" | "valido" | "invalido" | "enviado">("validando");
  const [pesquisa, setPesquisa] = useState<any>(null);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    (async () => {
      if (!token) return setEstado("invalido");
      // Valida o código no servidor (os códigos não ficam mais visíveis para visitantes)
      const { data: p } = await (supabase.rpc as any)("nr1_validar_token", { p_tipo: "lideranca", p_token: token });
      if (!p) return setEstado("invalido");
      setPesquisa(p); setEstado("valido");
    })();
  }, [token]);

  const enviar = async () => {
    const respostas = PERGUNTAS_LIDERANCA.map((q) => ({ pergunta_id: q.id, valor: valores[q.id] || 0 }));
    if (respostas.some((r) => !r.valor)) return toast.error("Responda todas as perguntas");
    // Grava a resposta e gasta o código na mesma operação
    const { error: e1 } = await (supabase.rpc as any)("nr1_enviar_resposta", {
      p_tipo: "lideranca", p_token: token, p_respostas: respostas, p_comentario: comentario || null,
    });
    if (e1) return toast.error(e1.message);
    setEstado("enviado");
  };

  if (estado === "validando") return <div className="min-h-screen flex items-center justify-center">Validando link...</div>;
  if (estado === "invalido") return <div className="min-h-screen flex items-center justify-center"><Card className="p-8 max-w-md text-center"><h2 className="text-xl font-bold mb-2">Link inválido</h2><p className="text-muted-foreground">Este link já foi utilizado ou expirou.</p></Card></div>;
  if (estado === "enviado") return <div className="min-h-screen flex items-center justify-center"><Card className="p-8 max-w-md text-center shadow-elegant"><CheckCircle2 className="h-16 w-16 mx-auto text-emerald-600 mb-4" /><h2 className="text-2xl font-bold mb-2">Resposta enviada</h2><p className="text-muted-foreground">Obrigado pela sua avaliação anônima.</p></Card></div>;

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="p-6 shadow-elegant">
          <div className="flex items-center gap-3 mb-2"><Star className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">{pesquisa.titulo}</h1></div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Resposta 100% anônima. Nenhuma identificação é armazenada.</p>
        </Card>

        {PERGUNTAS_LIDERANCA.map((q) => (
          <Card key={q.id} className="p-4">
            <p className="mb-3 font-medium">{q.texto}</p>
            <div className="flex gap-2 flex-wrap">
              {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                <Button key={n} size="sm" variant={valores[q.id] === n ? "default" : "outline"} onClick={() => setValores({ ...valores, [q.id]: n })}>{n}</Button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2"><span>Discordo totalmente</span><span>Concordo totalmente</span></div>
          </Card>
        ))}

        <Card className="p-4">
          <p className="mb-2 font-medium">Comentário adicional (opcional)</p>
          <Textarea value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="..." />
        </Card>

        <Button onClick={enviar} className="w-full" size="lg">Enviar avaliação</Button>
      </div>
    </div>
  );
}

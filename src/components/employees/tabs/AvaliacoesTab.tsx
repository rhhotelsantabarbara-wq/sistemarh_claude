import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HistoricoAvaliacoes from "@/components/avaliacoes/HistoricoAvaliacoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Send } from "lucide-react";
import { toast } from "sonner";
import { dataBR } from "@/lib/date";

interface AvaliacoesTabProps {
  employeeId: string;
}

export default function AvaliacoesTab({ employeeId }: AvaliacoesTabProps) {
  const [autoAvaliacaoNotas, setAutoAvaliacaoNotas] = useState<any>({});

  const { data: avaliacoesPendentes, refetch } = useQuery({
    queryKey: ["avaliacoes-pendentes", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avaliacoes_desempenho")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("auto_avaliacao_concluida", false)
        .in("status", ["pendente", "em_andamento"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: criterios } = useQuery({
    queryKey: ["criterios-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("criterios_avaliacao")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  const { data: metas } = useQuery({
    queryKey: ["metas-funcionario", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas_funcionario")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleAutoAvaliacao = async (avaliacaoId: string) => {
    try {
      // Inserir/atualizar notas da auto-avaliação
      for (const criterioId of Object.keys(autoAvaliacaoNotas)) {
        const nota = autoAvaliacaoNotas[criterioId];
        
        const { error } = await supabase
          .from("notas_avaliacao")
          .upsert({
            avaliacao_id: avaliacaoId,
            criterio_id: criterioId,
            nota_funcionario: nota.nota,
            comentario_funcionario: nota.comentario,
          }, {
            onConflict: "avaliacao_id,criterio_id"
          });

        if (error) throw error;
      }

      // Marcar auto-avaliação como concluída
      const { error } = await supabase
        .from("avaliacoes_desempenho")
        .update({
          auto_avaliacao_concluida: true,
          status: "em_andamento",
        })
        .eq("id", avaliacaoId);

      if (error) throw error;

      toast.success("Auto-avaliação enviada com sucesso!");
      setAutoAvaliacaoNotas({});
      refetch();
    } catch (error: any) {
      toast.error("Erro ao salvar auto-avaliação: " + error.message);
    }
  };

  const handleUpdateMeta = async (metaId: string, percentual: number) => {
    try {
      const { error } = await supabase
        .from("metas_funcionario")
        .update({
          percentual_conclusao: percentual,
          status: percentual >= 100 ? "concluida" : percentual > 0 ? "em_andamento" : "pendente",
        })
        .eq("id", metaId);

      if (error) throw error;
      toast.success("Meta atualizada com sucesso!");
      refetch();
    } catch (error: any) {
      toast.error("Erro ao atualizar meta: " + error.message);
    }
  };

  return (
    <Tabs defaultValue="historico" className="space-y-4">
      <TabsList>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
        <TabsTrigger value="autoavaliacao">
          Auto-avaliação {avaliacoesPendentes && avaliacoesPendentes.length > 0 && `(${avaliacoesPendentes.length})`}
        </TabsTrigger>
        <TabsTrigger value="metas">Metas ({metas?.length || 0})</TabsTrigger>
      </TabsList>

      <TabsContent value="historico">
        <HistoricoAvaliacoes employeeId={employeeId} />
      </TabsContent>

      <TabsContent value="autoavaliacao" className="space-y-4">
        {avaliacoesPendentes && avaliacoesPendentes.length > 0 ? (
          avaliacoesPendentes.map((avaliacao) => (
            <Card key={avaliacao.id}>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">Auto-avaliação Pendente</h3>
                  <p className="text-sm text-muted-foreground">
                    Período: {dataBR(avaliacao.periodo_inicio).toLocaleDateString()} até{" "}
                    {dataBR(avaliacao.periodo_fim).toLocaleDateString()}
                  </p>
                </div>

                <div className="space-y-4">
                  {criterios?.map((criterio) => (
                    <div key={criterio.id} className="border rounded-lg p-4 space-y-3">
                      <div>
                        <Label className="font-semibold">{criterio.nome}</Label>
                        {criterio.descricao && (
                          <p className="text-xs text-muted-foreground">{criterio.descricao}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Sua Nota (1-10)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          placeholder="Digite sua nota"
                          value={autoAvaliacaoNotas[criterio.id]?.nota || ""}
                          onChange={(e) => setAutoAvaliacaoNotas({
                            ...autoAvaliacaoNotas,
                            [criterio.id]: {
                              ...autoAvaliacaoNotas[criterio.id],
                              nota: parseInt(e.target.value),
                            },
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Comentário (opcional)</Label>
                        <Textarea
                          placeholder="Comente sobre sua avaliação neste critério..."
                          value={autoAvaliacaoNotas[criterio.id]?.comentario || ""}
                          onChange={(e) => setAutoAvaliacaoNotas({
                            ...autoAvaliacaoNotas,
                            [criterio.id]: {
                              ...autoAvaliacaoNotas[criterio.id],
                              comentario: e.target.value,
                            },
                          })}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => handleAutoAvaliacao(avaliacao.id)}>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Auto-avaliação
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Nenhuma auto-avaliação pendente no momento
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="metas" className="space-y-4">
        {metas && metas.length > 0 ? (
          metas.map((meta) => (
            <Card key={meta.id}>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold">{meta.titulo}</h3>
                  {meta.descricao && (
                    <p className="text-sm text-muted-foreground mt-1">{meta.descricao}</p>
                  )}
                  {meta.prazo && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Prazo: {dataBR(meta.prazo).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progresso</span>
                    <span className="font-medium">{meta.percentual_conclusao}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${meta.percentual_conclusao}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Atualizar Progresso (%)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      defaultValue={meta.percentual_conclusao}
                      onBlur={(e) => {
                        const valor = parseInt(e.target.value);
                        if (valor >= 0 && valor <= 100 && valor !== meta.percentual_conclusao) {
                          handleUpdateMeta(meta.id, valor);
                        }
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Nenhuma meta definida ainda
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}

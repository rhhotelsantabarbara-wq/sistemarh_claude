import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { todayISO, toISODateLocal, dataBR } from "@/lib/date";

export const ProximasAvaliacoes = () => {
  const { data: proximosCiclos } = useQuery({
    queryKey: ["proximos-ciclos"],
    queryFn: async () => {
      const hoje = todayISO();
      const proximoMes = new Date();
      proximoMes.setMonth(proximoMes.getMonth() + 1);
      
      const { data, error } = await supabase
        .from("ciclos_avaliacao")
        .select("*, empresas(nome), setores(nome), funcoes(nome)")
        .eq("ativo", true)
        .gte("data_proxima_execucao", hoje)
        .lte("data_proxima_execucao", toISODateLocal(proximoMes))
        .order("data_proxima_execucao", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: estatisticas } = useQuery({
    queryKey: ["estatisticas-ciclos"],
    queryFn: async () => {
      if (!proximosCiclos || proximosCiclos.length === 0) {
        return { totalFuncionarios: 0, totalCiclos: 0 };
      }

      let totalFuncionarios = 0;
      
      for (const ciclo of proximosCiclos) {
        let query = supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .in("status", ["ativo", "ferias"]);

        if (ciclo.empresa_id) query = query.eq("empresa_id", ciclo.empresa_id);
        if (ciclo.setor_id) query = query.eq("setor", ciclo.setor_id);
        if (ciclo.funcao_id) query = query.eq("cargo", ciclo.funcao_id);

        const { count } = await query;
        totalFuncionarios += count || 0;
      }

      return {
        totalFuncionarios,
        totalCiclos: proximosCiclos.length,
      };
    },
    enabled: !!proximosCiclos && proximosCiclos.length > 0,
  });

  if (!proximosCiclos || proximosCiclos.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Próximas Avaliações Automáticas
        </CardTitle>
        <CardDescription>
          Avaliações que serão criadas automaticamente nos próximos 30 dias
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Users className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{estatisticas?.totalFuncionarios || 0}</p>
                <p className="text-xs text-muted-foreground">Funcionários afetados</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{estatisticas?.totalCiclos || 0}</p>
                <p className="text-xs text-muted-foreground">Ciclos programados</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {proximosCiclos.slice(0, 3).map((ciclo) => (
              <div
                key={ciclo.id}
                className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="space-y-1">
                  <p className="font-medium">{ciclo.nome}</p>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>{ciclo.empresas?.nome || "Todas empresas"}</span>
                    {ciclo.setores?.nome && <span>• {ciclo.setores.nome}</span>}
                    {ciclo.funcoes?.nome && <span>• {ciclo.funcoes.nome}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline">
                    {format(dataBR(ciclo.data_proxima_execucao), "dd/MM/yyyy", { locale: ptBR })}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ciclo.tipo.charAt(0).toUpperCase() + ciclo.tipo.slice(1)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
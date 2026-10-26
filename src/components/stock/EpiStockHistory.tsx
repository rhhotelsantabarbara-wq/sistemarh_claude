import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { dataBR } from "@/lib/date";

const EpiStockHistory = () => {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMovements();
  }, []);

  const fetchMovements = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("historico_estoque_epis")
      .select(`
        *,
        estoque_epis:estoque_epi_id (tipo_epi, marca_modelo, tamanho),
        employees:employee_id (nome_completo),
        profiles:created_by (nome_completo)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && data) {
      setMovements(data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Carregando histórico...</p>
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Nenhuma movimentação registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {movements.map((movement) => (
        <Card key={movement.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base">
                  {movement.estoque_epis?.tipo_epi || "EPI não identificado"}
                  {movement.estoque_epis?.marca_modelo && ` - ${movement.estoque_epis.marca_modelo}`}
                  {movement.estoque_epis?.tamanho && ` (${movement.estoque_epis.tamanho})`}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {format(dataBR(movement.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <Badge variant={movement.tipo_movimentacao === "entrada" ? "default" : "secondary"}>
                {movement.tipo_movimentacao === "entrada" ? (
                  <ArrowUp className="w-3 h-3 mr-1" />
                ) : (
                  <ArrowDown className="w-3 h-3 mr-1" />
                )}
                {movement.tipo_movimentacao === "entrada" ? "Entrada" : "Saída"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Quantidade:</span>
                <span className="ml-2 font-medium">{movement.quantidade}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Estoque anterior:</span>
                <span className="ml-2 font-medium">{movement.quantidade_anterior}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Estoque novo:</span>
                <span className="ml-2 font-medium">{movement.quantidade_nova}</span>
              </div>
              {movement.employees && (
                <div>
                  <span className="text-muted-foreground">Funcionário:</span>
                  <span className="ml-2 font-medium">{movement.employees.nome_completo}</span>
                </div>
              )}
            </div>
            {movement.motivo && (
              <div className="pt-2 border-t">
                <span className="text-sm text-muted-foreground">Motivo: </span>
                <span className="text-sm">{movement.motivo}</span>
              </div>
            )}
            {movement.profiles && (
              <div className="text-xs text-muted-foreground">
                Registrado por: {movement.profiles.nome_completo}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default EpiStockHistory;

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { dataBR } from "@/lib/date";

const UniformDistributionHistory = () => {
  const [distributions, setDistributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDistributions();
  }, []);

  const fetchDistributions = async () => {
    const { data, error } = await supabase
      .from("uniformes")
      .select(`
        *,
        employees (
          nome_completo,
          setor
        )
      `)
      .order("data_entrega", { ascending: false });

    if (!error && data) {
      setDistributions(data);
    }
    setLoading(false);
  };

  if (loading) {
    return <p className="text-center py-4">Carregando...</p>;
  }

  if (distributions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Nenhuma distribuição de uniforme registrada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Uniforme</TableHead>
              <TableHead>Funcionário</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {distributions.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.tipo_uniforme}</TableCell>
                <TableCell>{item.employees?.nome_completo}</TableCell>
                <TableCell>{item.employees?.setor || "-"}</TableCell>
                <TableCell>{item.tamanho}</TableCell>
                <TableCell>{item.quantidade}</TableCell>
                <TableCell>
                  {format(dataBR(item.data_entrega), "dd/MM/yyyy", { locale: ptBR })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default UniformDistributionHistory;

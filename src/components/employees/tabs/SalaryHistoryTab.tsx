import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCanViewSalary } from "@/hooks/useCanViewSalary";
import { dataBR } from "@/lib/date";

interface SalaryHistoryTabProps {
  employeeId: string;
}

export function SalaryHistoryTab({ employeeId }: SalaryHistoryTabProps) {
  const { canViewSalary, loading: permLoading } = useCanViewSalary();
  const { data: history, isLoading } = useQuery({
    queryKey: ["salary-history", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_reajustes_salariais")
        .select(`
          *,
          aplicador:profiles!historico_reajustes_salariais_aplicado_por_fkey(nome_completo)
        `)
        .eq("employee_id", employeeId)
        .order("aplicado_em", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  if (permLoading || isLoading) {
    return <div className="p-6">Carregando histórico...</div>;
  }

  if (!canViewSalary) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Você não tem permissão para visualizar informações salariais.
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Nenhum reajuste salarial registrado para este funcionário.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-4">Histórico de Reajustes Salariais</h3>
      
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Salário Anterior</TableHead>
              <TableHead>Salário Novo</TableHead>
              <TableHead>Reajuste (%)</TableHead>
              <TableHead>Justificativa</TableHead>
              <TableHead>Aplicado Por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  {format(dataBR(record.aplicado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell>R$ {record.salario_anterior.toFixed(2)}</TableCell>
                <TableCell className="font-semibold text-green-600">
                  R$ {record.salario_novo.toFixed(2)}
                </TableCell>
                <TableCell>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                    +{record.percentual_reajuste?.toFixed(2)}%
                  </span>
                </TableCell>
                <TableCell className="max-w-md">
                  {record.justificativa}
                </TableCell>
                <TableCell>{record.aplicador?.nome_completo || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

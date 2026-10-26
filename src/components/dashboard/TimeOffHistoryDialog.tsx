import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { History } from "lucide-react";
import { dataBR } from "@/lib/date";

interface TimeOffHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId?: string;
}

const TimeOffHistoryDialog = ({
  open,
  onOpenChange,
  employeeId,
}: TimeOffHistoryDialogProps) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open, employeeId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("historico_folgas")
        .select(`
          *,
          employee:employees(nome_completo),
          alterado_por_profile:profiles(nome_completo)
        `)
        .order("alterado_em", { ascending: false });

      if (employeeId) {
        query = query.eq("employee_id", employeeId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Histórico de Alterações de Folgas
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Carregando histórico...
          </div>
        ) : history.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma alteração registrada
            </CardContent>
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {!employeeId && <TableHead>Funcionário</TableHead>}
                <TableHead>Data/Hora</TableHead>
                <TableHead>Anterior</TableHead>
                <TableHead>Nova</TableHead>
                <TableHead>Diferença</TableHead>
                <TableHead>Alterado Por</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((item) => {
                const diferenca = item.quantidade_nova - item.quantidade_anterior;
                return (
                  <TableRow key={item.id}>
                    {!employeeId && (
                      <TableCell className="font-medium">
                        {item.employee?.nome_completo || "—"}
                      </TableCell>
                    )}
                    <TableCell>
                      {dataBR(item.alterado_em).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>{item.quantidade_anterior}</TableCell>
                    <TableCell>{item.quantidade_nova}</TableCell>
                    <TableCell>
                      <span
                        className={
                          diferenca > 0
                            ? "text-green-600"
                            : diferenca < 0
                            ? "text-red-600"
                            : ""
                        }
                      >
                        {diferenca > 0 ? "+" : ""}
                        {diferenca}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.alterado_por_profile?.nome_completo || "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {item.observacao || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TimeOffHistoryDialog;

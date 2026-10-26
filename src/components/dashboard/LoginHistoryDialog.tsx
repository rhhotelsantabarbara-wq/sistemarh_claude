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
import { toast } from "sonner";
import { dataBR } from "@/lib/date";

interface LoginHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LoginRecord {
  id: string;
  login_at: string;
  ip_address: string | null;
  user_agent: string | null;
  employee_name: string | null;
}

const LoginHistoryDialog = ({ open, onOpenChange }: LoginHistoryDialogProps) => {
  const [loginHistory, setLoginHistory] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchLoginHistory();
    }
  }, [open]);

  const fetchLoginHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("login_history")
        .select(`
          id,
          login_at,
          ip_address,
          user_agent,
          employee_id,
          employees (nome_completo)
        `)
        .order("login_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const formattedData = data.map((record: any) => ({
        id: record.id,
        login_at: record.login_at,
        ip_address: record.ip_address,
        user_agent: record.user_agent,
        employee_name: record.employees?.nome_completo || "Usuário deletado",
      }));

      setLoginHistory(formattedData);
    } catch (error: any) {
      toast.error("Erro ao carregar histórico", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Login dos Funcionários</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        ) : loginHistory.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Nenhum registro de login encontrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Data e Hora</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Navegador</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loginHistory.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">
                    {record.employee_name}
                  </TableCell>
                  <TableCell>
                    {dataBR(record.login_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>{record.ip_address || "N/A"}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {record.user_agent || "N/A"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LoginHistoryDialog;

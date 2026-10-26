import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Eye, Check, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { dataBR } from "@/lib/date";

interface AvisoLeiturasDialogProps {
  aviso: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Leitura {
  id: string;
  lido_em: string;
  employee: {
    id: string;
    nome_completo: string;
    setor: string | null;
  };
}

const AvisoLeiturasDialog = ({ aviso, open, onOpenChange }: AvisoLeiturasDialogProps) => {
  const [leituras, setLeituras] = useState<Leitura[]>([]);
  const [totalDestinatarios, setTotalDestinatarios] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && aviso) {
      fetchLeituras();
      fetchTotalDestinatarios();
    }
  }, [open, aviso]);

  const fetchLeituras = async () => {
    if (!aviso?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("avisos_leituras")
        .select(`
          id,
          lido_em,
          employee_id,
          employees!inner(id, nome_completo, setor)
        `)
        .eq("aviso_id", aviso.id)
        .order("lido_em", { ascending: false });

      if (error) throw error;

      const formattedLeituras = (data || []).map((item: any) => ({
        id: item.id,
        lido_em: item.lido_em,
        employee: {
          id: item.employees.id,
          nome_completo: item.employees.nome_completo,
          setor: item.employees.setor,
        },
      }));

      setLeituras(formattedLeituras);
    } catch (error) {
      console.error("Error fetching leituras:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTotalDestinatarios = async () => {
    if (!aviso) return;

    try {
      let query = supabase.from("employees").select("id", { count: "exact", head: true }).in("status", ["ativo", "ferias"]);

      if (aviso.tipo_destinatario === "setor" && aviso.setores?.length > 0) {
        query = query.in("setor", aviso.setores);
      } else if (aviso.tipo_destinatario === "empresa" && aviso.empresa_id) {
        query = query.eq("empresa_id", aviso.empresa_id);
      } else if (aviso.tipo_destinatario === "funcionario" && aviso.funcionarios_ids?.length > 0) {
        query = query.in("id", aviso.funcionarios_ids);
      }

      const { count } = await query;
      setTotalDestinatarios(count || 0);
    } catch (error) {
      console.error("Error fetching total destinatarios:", error);
    }
  };

  const percentualLeitura = totalDestinatarios > 0 
    ? Math.round((leituras.length / totalDestinatarios) * 100) 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Confirmações de Leitura
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Estatísticas */}
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Leituras</p>
              <p className="text-2xl font-bold">
                {leituras.length} / {totalDestinatarios}
              </p>
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Percentual</p>
              <p className="text-2xl font-bold">{percentualLeitura}%</p>
            </div>
            <div className="flex-shrink-0">
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    className="text-muted"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray={175.9}
                    strokeDashoffset={175.9 - (175.9 * percentualLeitura) / 100}
                    className="text-primary"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Lista de leituras */}
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Carregando...</p>
          ) : leituras.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Nenhuma leitura registrada ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leituras.map((leitura) => (
                <div
                  key={leitura.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{leitura.employee.nome_completo}</p>
                      {leitura.employee.setor && (
                        <p className="text-xs text-muted-foreground">{leitura.employee.setor}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline">
                    {format(dataBR(leitura.lido_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AvisoLeiturasDialog;

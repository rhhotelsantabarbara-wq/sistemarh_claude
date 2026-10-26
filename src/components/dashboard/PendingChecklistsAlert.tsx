import { useState, useEffect } from "react";
import { parseDateOnly, dataBR } from "@/lib/date";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { ClipboardList, UserPlus, UserMinus, AlertTriangle } from "lucide-react";

export function PendingChecklistsAlert() {
  const navigate = useNavigate();
  const [admissoes, setAdmissoes] = useState(0);
  const [desligamentos, setDesligamentos] = useState(0);
  const [atrasados, setAtrasados] = useState(0);

  useEffect(() => {
    fetchPendingChecklists();
  }, []);

  const fetchPendingChecklists = async () => {
    try {
      const { data, error } = await supabase
        .from("plano_checklist_funcionario")
        .select(`
          tipo,
          data_inicio,
          itens:plano_checklist_funcionario_itens(concluido, prazo_dias)
        `)
        .eq("status", "em_andamento");

      if (error) throw error;

      let admCount = 0;
      let desCount = 0;
      let atrasadosCount = 0;

      data?.forEach((checklist) => {
        if (checklist.tipo === "admissao") admCount++;
        else desCount++;

        checklist.itens?.forEach((item: any) => {
          if (!item.concluido && item.prazo_dias) {
            const dataInicio = (parseDateOnly(checklist.data_inicio) ?? new Date());
            const prazoData = dataBR(dataInicio);
            prazoData.setDate(prazoData.getDate() + item.prazo_dias);
            if (new Date() > prazoData) atrasadosCount++;
          }
        });
      });

      setAdmissoes(admCount);
      setDesligamentos(desCount);
      setAtrasados(atrasadosCount);
    } catch (error) {
      console.error("Error fetching pending checklists:", error);
    }
  };

  if (admissoes === 0 && desligamentos === 0) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Processos em Andamento
          </CardTitle>
          {atrasados > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {atrasados} atrasados
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {admissoes > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <UserPlus className="h-4 w-4 text-green-600" />
              <span>
                <strong>{admissoes}</strong> admissão(ões)
              </span>
            </div>
          )}
          {desligamentos > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <UserMinus className="h-4 w-4 text-amber-600" />
              <span>
                <strong>{desligamentos}</strong> desligamento(s)
              </span>
            </div>
          )}
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/plano-admissao-desligamento")}
          >
            Ver todos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

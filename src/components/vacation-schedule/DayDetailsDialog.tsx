import { format, differenceInDays, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Calendar, Users, Building2, MapPin } from "lucide-react";
import type { VacationEvent } from "./types";
import { STATUS_COLORS, STATUS_LABELS } from "./types";
import { dataBR } from "@/lib/date";

interface DayDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  vacations: VacationEvent[];
  onAddVacation: () => void;
}

export function DayDetailsDialog({
  open,
  onOpenChange,
  selectedDate,
  vacations,
  onAddVacation,
}: DayDetailsDialogProps) {
  if (!selectedDate) return null;

  const formattedDate = format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  });

  const isWeekendDay = isWeekend(selectedDate);

  // Agrupar por setor
  const vacationsBySetor = vacations.reduce((acc, vacation) => {
    const setor = vacation.setor || "Sem setor";
    if (!acc[setor]) acc[setor] = [];
    acc[setor].push(vacation);
    return acc;
  }, {} as Record<string, VacationEvent[]>);

  const setoresComMaisDeUm = Object.entries(vacationsBySetor).filter(
    ([_, items]) => items.length > 1
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <DialogTitle className="capitalize text-lg">
              {formattedDate}
            </DialogTitle>
          </div>
          {isWeekendDay && (
            <Badge variant="secondary" className="w-fit mt-2">
              Fim de Semana
            </Badge>
          )}
        </DialogHeader>

        <div className="py-4 flex-1 overflow-hidden">
          {/* Estatísticas do dia */}
          <div className="flex items-center gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {vacations.length === 0
                  ? "Nenhum funcionário de férias"
                  : vacations.length === 1
                  ? "1 funcionário de férias"
                  : `${vacations.length} funcionários de férias`}
              </span>
            </div>
          </div>

          {/* Alerta de conflito por setor */}
          {setoresComMaisDeUm.length > 0 && (
            <div className="mb-4 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg border border-amber-300 dark:border-amber-700">
              <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                ⚠️ Atenção: Múltiplos funcionários do mesmo setor ausentes
              </p>
              <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                {setoresComMaisDeUm.map(([setor, items]) => (
                  <span key={setor} className="block">
                    • {setor}: {items.length} funcionários
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Lista de funcionários */}
          {vacations.length > 0 ? (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {vacations.map((vacation, index) => {
                  const colors = STATUS_COLORS[vacation.status];
                  const startDate = dataBR(vacation.periodo_inicio);
                  const endDate = dataBR(vacation.periodo_fim);
                  const totalDays = differenceInDays(endDate, startDate) + 1;
                  const daysRemaining = differenceInDays(endDate, selectedDate!) + 1;

                  return (
                    <Card
                      key={`${vacation.employee_id}-${index}`}
                      className={`border-l-4 ${colors.border}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm truncate">
                              {vacation.employee_name}
                            </h4>
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span>{vacation.setor || "Sem setor"}</span>
                            </div>
                            {vacation.empresa_nome && (
                              <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                                <Building2 className="h-3 w-3" />
                                <span>{vacation.empresa_nome}</span>
                              </div>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={`shrink-0 ${colors.text} ${colors.bg} ${colors.border}`}
                          >
                            {STATUS_LABELS[vacation.status]}
                          </Badge>
                        </div>

                        <div className="mt-3 pt-3 border-t space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Período:</span>
                            <span className="font-medium">
                              {format(startDate, "dd/MM")} - {format(endDate, "dd/MM/yyyy")}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Total de dias:</span>
                            <span className="font-medium">{totalDays} dias</span>
                          </div>
                          {vacation.status === "em_andamento" && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Dias restantes:</span>
                              <span className="font-medium text-amber-600 dark:text-amber-400">
                                {daysRemaining} {daysRemaining === 1 ? "dia" : "dias"}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Nenhum funcionário de férias neste dia</p>
              <p className="text-xs mt-1">Clique abaixo para adicionar férias</p>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={onAddVacation}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Férias
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Cake, Calendar, AlertCircle } from "lucide-react";
import { useBirthdays } from "@/hooks/useBirthdays";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface BirthdayListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId?: string;
}

interface Setor {
  id: string;
  nome: string;
}

export const BirthdayListDialog = ({
  open,
  onOpenChange,
  empresaId,
}: BirthdayListDialogProps) => {
  const [selectedSetor, setSelectedSetor] = useState<string>("all");
  const [setores, setSetores] = useState<Setor[]>([]);
  const [activeTab, setActiveTab] = useState("today");

  const {
    birthdaysToday,
    birthdaysThisMonth,
    birthdaysNext7Days,
    employeesWithoutBirthday,
    loading,
  } = useBirthdays(
    empresaId,
    selectedSetor !== "all" ? selectedSetor : undefined
  );

  useEffect(() => {
    fetchSetores();
  }, []);

  const fetchSetores = async () => {
    const { data } = await supabase
      .from("setores")
      .select("id, nome")
      .order("nome");
    
    if (data) {
      setSetores(data);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const formatDate = (day: number, month: number) => {
    return `${day.toString().padStart(2, "0")}/${(month + 1).toString().padStart(2, "0")}`;
  };

  const renderEmployeeList = (employees: any[], emptyMessage: string) => {
    if (loading) {
      return (
        <div className="space-y-3 py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
              <div className="w-12 h-12 bg-muted rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (employees.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Cake className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="space-y-2 py-4">
        {employees.map((employee) => {
          const isToday = birthdaysToday.some((b) => b.id === employee.id);
          
          return (
            <div
              key={employee.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                isToday
                  ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
                  : "hover:bg-muted/50"
              }`}
            >
              <Avatar className="w-12 h-12">
                <AvatarImage src={employee.foto_url || undefined} />
                <AvatarFallback
                  className={`text-sm ${
                    isToday ? "bg-green-500" : "bg-primary"
                  } text-white`}
                >
                  {getInitials(employee.nome_completo)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium truncate">{employee.nome_completo}</p>
                  {isToday && (
                    <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs">
                      HOJE 🎉
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {employee.cargo}
                  {employee.setor && ` • ${employee.setor}`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(employee.dayOfMonth, employee.monthNumber)} • {employee.age} anos
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const totalEmployeesQuery = supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .in("status", ["ativo", "ferias"]);

  useEffect(() => {
    const getTotal = async () => {
      const { count } = await totalEmployeesQuery;
    };
    getTotal();
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cake className="w-5 h-5 text-amber-500" />
            Aniversariantes
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex gap-2">
          <Select value={selectedSetor} onValueChange={setSelectedSetor}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {setores.map((setor) => (
                <SelectItem key={setor.id} value={setor.nome}>
                  {setor.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Warning about missing birthdays */}
        {employeesWithoutBirthday > 0 && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              {employeesWithoutBirthday} funcionário{employeesWithoutBirthday !== 1 ? "s" : ""} sem data de nascimento cadastrada
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="inline-flex w-full overflow-x-auto tabs-scroll">
            <TabsTrigger value="today" className="flex-shrink-0 flex items-center gap-2">
              <Cake className="w-4 h-4" />
              Hoje ({birthdaysToday.length})
            </TabsTrigger>
            <TabsTrigger value="month" className="flex-shrink-0 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Este Mês ({birthdaysThisMonth.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex-shrink-0 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Próximos 7 Dias ({birthdaysNext7Days.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="today" className="mt-0">
              {renderEmployeeList(
                birthdaysToday,
                "Nenhum aniversariante hoje"
              )}
            </TabsContent>

            <TabsContent value="month" className="mt-0">
              {renderEmployeeList(
                birthdaysThisMonth,
                "Nenhum aniversariante este mês"
              )}
            </TabsContent>

            <TabsContent value="upcoming" className="mt-0">
              {renderEmployeeList(
                birthdaysNext7Days,
                "Nenhum aniversariante nos próximos 7 dias"
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

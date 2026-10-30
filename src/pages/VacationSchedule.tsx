import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Calendar, ClipboardList, History, Settings, ArrowLeft, Plus, FileDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { VacationCalendar } from "@/components/vacation-schedule/VacationCalendar";
import { VacationTimeline } from "@/components/vacation-schedule/VacationTimeline";
import { VacationList } from "@/components/vacation-schedule/VacationList";
import { VacationFilters } from "@/components/vacation-schedule/VacationFilters";
import { VacationSettings } from "@/components/vacation-schedule/VacationSettings";
import { AddVacationDialog } from "@/components/vacation-schedule/AddVacationDialog";
import { ApproveVacationDialog } from "@/components/vacation-schedule/ApproveVacationDialog";
import { ExportVacationDialog } from "@/components/vacation-schedule/ExportVacationDialog";
import { ControleFerias } from "@/components/vacation-schedule/ControleFerias";
import type { VacationFiltersType } from "@/components/vacation-schedule/types";
import type { FeriasPlanejada } from "@/lib/feriasCalculo";

export default function VacationSchedule() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<VacationFiltersType>({
    empresa: "all",
    setor: "all",
    periodo: { start: null, end: null },
    status: "all",
    search: "",
    ano: undefined,
    feriasVencidas: false,
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [programarPara, setProgramarPara] = useState<string | null>(null);
  const [aprovar, setAprovar] = useState<FeriasPlanejada | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [visaoCalendario, setVisaoCalendario] = useState<"mes" | "linha">("linha");

  const handleRefresh = () => setRefreshKey((prev) => prev + 1);

  const abrirProgramar = (employeeId: string | null) => {
    setProgramarPara(employeeId);
    setShowAddDialog(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} aria-label="Voltar">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Férias</h1>
                <p className="text-sm text-muted-foreground">
                  Saldo, prazos e programação de férias da equipe
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowExportDialog(true)}>
                <FileDown className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button onClick={() => abrirProgramar(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Programar férias
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Tabs defaultValue="controle" className="w-full">
          <TabsList className="inline-flex w-full overflow-x-auto tabs-scroll">
            <TabsTrigger value="controle" className="flex-shrink-0 flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span>Controle</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex-shrink-0 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Calendário</span>
            </TabsTrigger>
            <TabsTrigger value="list" className="flex-shrink-0 flex items-center gap-2">
              <History className="h-4 w-4" />
              <span>Lançamentos</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-shrink-0 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configurações</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="controle" className="mt-6">
            <ControleFerias
              key={`controle-${refreshKey}`}
              filters={filters}
              onFiltersChange={setFilters}
              onProgramar={(id) => abrirProgramar(id)}
              onAprovar={(p) => setAprovar(p)}
            />
          </TabsContent>

          <TabsContent value="calendar" className="mt-6 space-y-4">
            <Card className="p-6">
              <VacationFilters filters={filters} onFiltersChange={setFilters} />
            </Card>
            <div className="inline-flex rounded-lg border p-1" role="group" aria-label="Visualização">
              <Button size="sm" variant={visaoCalendario === "linha" ? "default" : "ghost"} aria-pressed={visaoCalendario === "linha"} onClick={() => setVisaoCalendario("linha")}>Linha do tempo</Button>
              <Button size="sm" variant={visaoCalendario === "mes" ? "default" : "ghost"} aria-pressed={visaoCalendario === "mes"} onClick={() => setVisaoCalendario("mes")}>Mês</Button>
            </div>
            {visaoCalendario === "mes" ? (
              <VacationCalendar filters={filters} onRefresh={handleRefresh} key={`calendar-${refreshKey}`} />
            ) : (
              <VacationTimeline filters={filters} key={`timeline-${refreshKey}`} />
            )}
          </TabsContent>

          <TabsContent value="list" className="mt-6 space-y-4">
            <VacationList filters={filters} onRefresh={handleRefresh} key={`list-${refreshKey}`} />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <VacationSettings />
          </TabsContent>
        </Tabs>
      </main>

      <AddVacationDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        selectedDate={null}
        employeeIdInicial={programarPara}
        onSuccess={() => {
          handleRefresh();
          setShowAddDialog(false);
        }}
      />

      <ApproveVacationDialog
        open={!!aprovar}
        onOpenChange={(o) => { if (!o) setAprovar(null); }}
        plannedVacation={aprovar}
        onSuccess={handleRefresh}
      />

      <ExportVacationDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        filters={filters}
      />
    </div>
  );
}

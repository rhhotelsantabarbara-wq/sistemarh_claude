import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Calendar as CalendarIcon, List, Download, Loader2 } from "lucide-react";
import EventoCalendar from "@/components/eventos/EventoCalendar";
import EventoList from "@/components/eventos/EventoList";
import EventoForm from "@/components/eventos/EventoForm";
import { GoogleCalendarSettings } from "@/components/eventos/GoogleCalendarSettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadMultipleEventsAsICS } from "@/lib/icsGenerator";

const Eventos = () => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    setShowForm(false);
  };

  const handleAddEvent = (date?: Date) => {
    setSelectedDate(date || null);
    setShowForm(true);
  };

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const { data: eventos, error } = await supabase
        .from("eventos")
        .select("id, titulo, descricao, data_inicio, data_fim, local")
        .order("data_inicio", { ascending: true });

      if (error) throw error;

      if (!eventos || eventos.length === 0) {
        toast.info("Nenhum evento para exportar");
        return;
      }

      downloadMultipleEventsAsICS(eventos, "todos-eventos");
      toast.success(`Exportados ${eventos.length} eventos`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar eventos");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex-wrap gap-3 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold">Calendário de Eventos</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExportAll} disabled={exporting}>
              {exporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Exportar .ICS
            </Button>
            
            <Dialog open={showForm} onOpenChange={setShowForm}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Evento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Evento</DialogTitle>
                </DialogHeader>
                <EventoForm 
                  onSaved={handleRefresh} 
                  onCancel={() => setShowForm(false)}
                  initialDate={selectedDate}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="mb-6">
          <GoogleCalendarSettings onRefresh={handleRefresh} />
        </div>

        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="calendar">
              <CalendarIcon className="w-4 h-4 mr-2" />
              Calendário
            </TabsTrigger>
            <TabsTrigger value="list">
              <List className="w-4 h-4 mr-2" />
              Lista
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-6">
            <EventoCalendar 
              key={`calendar-${refreshKey}`}
              onAddEvent={handleAddEvent}
              onRefresh={handleRefresh}
            />
          </TabsContent>

          <TabsContent value="list" className="mt-6">
            <EventoList 
              key={`list-${refreshKey}`}
              onRefresh={handleRefresh}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Eventos;

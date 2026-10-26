import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Calendar, Clock, MapPin, ChevronRight, X } from "lucide-react";
import { format, parseISO, isToday, isTomorrow, isPast, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { dataBR } from "@/lib/date";

interface Evento {
  id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  local: string | null;
  tipo: string;
  cor: string;
  concluido: boolean | null;
}

const EventoNotifications = () => {
  const navigate = useNavigate();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUpcomingEvents();
    
    // Load dismissed notifications from localStorage
    const dismissed = localStorage.getItem("dismissedEventNotifications");
    if (dismissed) {
      const parsed = JSON.parse(dismissed);
      // Clean up old dismissed IDs (older than 2 days)
      const now = new Date().getTime();
      const twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000);
      const validDismissed = Object.entries(parsed)
        .filter(([_, timestamp]) => (timestamp as number) > twoDaysAgo)
        .map(([id]) => id);
      setDismissedIds(validDismissed);
    }
  }, []);

  const fetchUpcomingEvents = async () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayAfterTomorrow = dataBR(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    
    // Buscar eventos passados não concluídos (últimos 7 dias) + eventos dos próximos 2 dias
    const sevenDaysAgo = dataBR(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from("eventos")
      .select("*")
      .gte("data_inicio", sevenDaysAgo.toISOString())
      .lt("data_inicio", dayAfterTomorrow.toISOString())
      .order("data_inicio");

    if (!error && data) {
      // Filtrar: eventos futuros OU eventos passados não concluídos
      const filteredEvents = data.filter(evento => {
        const eventDate = parseISO(evento.data_inicio);
        const isEventPast = isPast(eventDate);
        
        // Se o evento já passou, só mostrar se NÃO estiver concluído
        if (isEventPast) {
          return evento.concluido !== true;
        }
        
        // Eventos futuros sempre aparecem
        return true;
      });
      
      setEventos(filteredEvents);
    }
    setLoading(false);
  };

  const dismissNotification = (id: string) => {
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    
    // Save to localStorage with timestamps
    const dismissed = localStorage.getItem("dismissedEventNotifications");
    const parsed = dismissed ? JSON.parse(dismissed) : {};
    parsed[id] = new Date().getTime();
    localStorage.setItem("dismissedEventNotifications", JSON.stringify(parsed));
  };

  const visibleEvents = eventos.filter(e => !dismissedIds.includes(e.id));

  if (loading || visibleEvents.length === 0) {
    return null;
  }

  const getEventUrgency = (evento: Evento) => {
    const eventDate = parseISO(evento.data_inicio);
    const hoursUntil = differenceInHours(eventDate, new Date());
    
    // Evento atrasado (passado e não concluído)
    if (isPast(eventDate) && !isToday(eventDate)) {
      return { label: "Atrasado", variant: "destructive" as const, priority: 0 };
    }
    
    if (isToday(eventDate)) {
      if (hoursUntil <= 0) {
        // Evento de hoje que já passou a hora
        return { label: "Atrasado", variant: "destructive" as const, priority: 0 };
      }
      if (hoursUntil <= 1) {
        return { label: "Agora!", variant: "destructive" as const, priority: 1 };
      }
      return { label: "Hoje", variant: "destructive" as const, priority: 2 };
    }
    if (isTomorrow(eventDate)) {
      return { label: "Amanhã", variant: "secondary" as const, priority: 3 };
    }
    return { label: "Em breve", variant: "outline" as const, priority: 4 };
  };

  const sortedEvents = [...visibleEvents].sort((a, b) => {
    const urgencyA = getEventUrgency(a).priority;
    const urgencyB = getEventUrgency(b).priority;
    return urgencyA - urgencyB;
  });

  const tipoLabels: Record<string, string> = {
    geral: "Geral",
    reuniao: "Reunião",
    treinamento: "Treinamento",
    feriado: "Feriado",
    evento_empresa: "Evento da Empresa",
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary animate-pulse" />
            Eventos Próximos
            <Badge variant="secondary" className="ml-2">
              {visibleEvents.length}
            </Badge>
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate("/eventos")}
          >
            Ver todos
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedEvents.map((evento) => {
          const urgency = getEventUrgency(evento);
          const eventDate = parseISO(evento.data_inicio);
          
          return (
            <div
              key={evento.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-background border hover:border-primary/50 transition-colors"
            >
              <div
                className="w-1 h-full min-h-12 rounded-full flex-shrink-0"
                style={{ backgroundColor: evento.cor }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-sm truncate">{evento.titulo}</h4>
                      <Badge variant={urgency.variant} className="text-xs">
                        {urgency.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tipoLabels[evento.tipo] || evento.tipo}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={() => dismissNotification(evento.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(eventDate, "dd/MM", { locale: ptBR })}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(eventDate, "HH:mm")}
                  </div>
                  {evento.local && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate max-w-24">{evento.local}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default EventoNotifications;

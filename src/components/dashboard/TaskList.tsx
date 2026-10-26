import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Trash2,
  ListTodo,
  CalendarDays,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { dataBR } from "@/lib/date";

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: string;
  data_vencimento: string | null;
  concluida: boolean;
  concluida_em: string | null;
  created_at: string;
}

const prioridadeConfig: Record<string, { label: string; className: string; order: number }> = {
  alta: { label: "Alta", className: "bg-destructive text-destructive-foreground", order: 0 },
  media: { label: "Média", className: "bg-primary text-primary-foreground", order: 1 },
  baixa: { label: "Baixa", className: "bg-muted text-muted-foreground", order: 2 },
};

export default function TaskList() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaPrioridade, setNovaPrioridade] = useState("media");
  const [novaDataVencimento, setNovaDataVencimento] = useState<Date | undefined>();
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    fetchTarefas();
  }, []);

  const fetchTarefas = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from("tarefas")
      .select("*")
      .eq("user_id", session.user.id)
      .order("concluida", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar tarefas:", error);
    } else {
      setTarefas(data || []);
    }
    setLoading(false);
  };

  const sortedTarefas = [...tarefas].sort((a, b) => {
    if (a.concluida !== b.concluida) return a.concluida ? 1 : -1;
    const pa = prioridadeConfig[a.prioridade]?.order ?? 1;
    const pb = prioridadeConfig[b.prioridade]?.order ?? 1;
    if (pa !== pb) return pa - pb;
    if (a.data_vencimento && b.data_vencimento) return a.data_vencimento.localeCompare(b.data_vencimento);
    if (a.data_vencimento) return -1;
    if (b.data_vencimento) return 1;
    return 0;
  });

  const addTarefa = async () => {
    if (!novoTitulo.trim()) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from("tarefas").insert({
      user_id: session.user.id,
      titulo: novoTitulo.trim(),
      prioridade: novaPrioridade,
      data_vencimento: novaDataVencimento ? format(novaDataVencimento, "yyyy-MM-dd") : null,
    });

    if (error) {
      toast.error("Erro ao criar tarefa");
    } else {
      setNovoTitulo("");
      setNovaPrioridade("media");
      setNovaDataVencimento(undefined);
      fetchTarefas();
    }
  };

  const toggleConcluida = async (tarefa: Tarefa) => {
    const concluida = !tarefa.concluida;
    const { error } = await supabase
      .from("tarefas")
      .update({
        concluida,
        concluida_em: concluida ? new Date().toISOString() : null,
      })
      .eq("id", tarefa.id);

    if (error) {
      toast.error("Erro ao atualizar tarefa");
    } else {
      fetchTarefas();
    }
  };

  const deleteTarefa = async (id: string) => {
    const { error } = await supabase.from("tarefas").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir tarefa");
    } else {
      fetchTarefas();
    }
  };

  const pendentes = tarefas.filter((t) => !t.concluida).length;

  const isOverdue = (dataVencimento: string | null) => {
    if (!dataVencimento) return false;
    return dataBR(dataVencimento + "T23:59:59") < new Date();
  };

  return (
    <Card>
      <CardHeader
        className="cursor-pointer flex flex-row items-center justify-between pb-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">
            Minhas Tarefas
            {pendentes > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendentes} pendente{pendentes > 1 ? "s" : ""}
              </Badge>
            )}
          </CardTitle>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3">
          {/* Add task form */}
          <div className="flex gap-2">
            <Input
              placeholder="Nova tarefa..."
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTarefa()}
              className="flex-1"
            />
            <Select value={novaPrioridade} onValueChange={setNovaPrioridade}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" title="Data de vencimento">
                  <CalendarDays className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={novaDataVencimento}
                  onSelect={(d) => {
                    setNovaDataVencimento(d);
                    setShowDatePicker(false);
                  }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <Button size="icon" onClick={addTarefa} disabled={!novoTitulo.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {novaDataVencimento && (
            <p className="text-xs text-muted-foreground">
              Vencimento: {format(novaDataVencimento, "dd/MM/yyyy", { locale: ptBR })}
              <Button variant="link" size="sm" className="h-auto p-0 ml-2 text-xs" onClick={() => setNovaDataVencimento(undefined)}>
                Remover
              </Button>
            </p>
          )}

          {/* Task list */}
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : sortedTarefas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma tarefa criada ainda.
            </p>
          ) : (
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {sortedTarefas.map((tarefa) => (
                <div
                  key={tarefa.id}
                  className={`flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 transition-colors group ${
                    tarefa.concluida ? "opacity-50" : ""
                  }`}
                >
                  <Checkbox
                    checked={tarefa.concluida}
                    onCheckedChange={() => toggleConcluida(tarefa)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${tarefa.concluida ? "line-through text-muted-foreground" : ""}`}>
                      {tarefa.titulo}
                    </p>
                    {tarefa.data_vencimento && !tarefa.concluida && (
                      <p className={`text-xs ${isOverdue(tarefa.data_vencimento) ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {isOverdue(tarefa.data_vencimento) ? "Vencida: " : "Vence: "}
                        {format(dataBR(tarefa.data_vencimento + "T12:00:00"), "dd/MM/yyyy")}
                      </p>
                    )}
                  </div>
                  <Badge className={prioridadeConfig[tarefa.prioridade]?.className || ""}>
                    {prioridadeConfig[tarefa.prioridade]?.label || tarefa.prioridade}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteTarefa(tarefa.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

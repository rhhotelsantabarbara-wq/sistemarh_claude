import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Briefcase, Calendar, TrendingUp, UserMinus, UserPlus, Clock, FileText, AlertTriangle, PenLine } from "lucide-react";
import { toISODateLocal } from "@/lib/date";

const NOME_CAMPO: Record<string, string> = {
  cargo: "Função", setor: "Setor", empresa_id: "Empresa", salario: "Salário", tipo_salario: "Tipo de salário",
  tipo_contrato: "Tipo de contrato", status: "Situação", gestor_id: "Gestor direto", escala: "Escala",
  horario_trabalho: "Horário", horas_semanais: "Horas semanais", centro_custo: "Centro de custo",
  local_trabalho: "Local de trabalho", data_admissao: "Data de admissão", data_desligamento: "Data de desligamento",
  codigo_funcionario: "Código do funcionário",
};
const ROTULO_VALOR: Record<string, Record<string, string>> = {
  status: { em_admissao: "Em admissão", ativo: "Ativo", afastado: "Afastado", demitido: "Demitido", ferias: "Férias" },
  tipo_contrato: { fixo: "Fixo", intermitente: "Intermitente", prestador_servico: "Prestador de serviço" },
  tipo_salario: { mensal: "Mensal", diario: "Diário", por_hora: "Por hora" },
};
const valorAlteracao = (campo: string, v: string | null) => {
  if (v === null || v === "") return "vazio";
  if (ROTULO_VALOR[campo]?.[v]) return ROTULO_VALOR[campo][v];
  if (campo === "salario") return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split("-").reverse().join("/");
  return v;
};
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TimelineEvent {
  id: string;
  date: string;
  type: "admissao" | "ferias" | "reajuste" | "desligamento" | "readmissao" | "afastamento" | "falta" | "folga" | "alteracao";
  title: string;
  description?: string;
  icon: React.ReactNode;
  color: string;
}

interface HistoricoTimelineTabProps {
  employeeId: string;
  employee: any;
}

const typeConfig: Record<string, { label: string; color: string }> = {
  admissao: { label: "Admissão", color: "bg-emerald-500" },
  readmissao: { label: "Readmissão", color: "bg-blue-500" },
  ferias: { label: "Férias", color: "bg-amber-500" },
  reajuste: { label: "Reajuste Salarial", color: "bg-violet-500" },
  desligamento: { label: "Desligamento", color: "bg-red-500" },
  afastamento: { label: "Afastamento", color: "bg-orange-500" },
  falta: { label: "Falta", color: "bg-rose-400" },
  folga: { label: "Folga", color: "bg-sky-400" },
  alteracao: { label: "Alteração de cadastro", color: "bg-slate-500" },
};

const HistoricoTimelineTab = ({ employeeId, employee }: HistoricoTimelineTabProps) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimeline();
  }, [employeeId]);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const [feriasRes, reajustesRes, afastamentosRes, faltasRes, folgasRes, alteracoesRes] = await Promise.all([
        supabase.from("ferias").select("*").eq("employee_id", employeeId),
        supabase.from("historico_reajustes_salariais").select("*").eq("employee_id", employeeId),
        supabase.from("afastamentos").select("*").eq("employee_id", employeeId),
        supabase.from("faltas").select("*").eq("employee_id", employeeId),
        supabase.from("folgas").select("*").eq("employee_id", employeeId),
        (supabase as any).from("employee_alteracoes").select("*").eq("employee_id", employeeId).order("alterado_em", { ascending: false }).limit(300),
      ]);

      // Quem alterou (nome do perfil)
      const autores = Array.from(new Set(((alteracoesRes.data || []) as any[]).map((a) => a.alterado_por).filter(Boolean)));
      const nomesAutores: Record<string, string> = {};
      if (autores.length) {
        const { data: perfis } = await supabase.from("profiles").select("id, nome_completo").in("id", autores);
        (perfis || []).forEach((p: any) => { nomesAutores[p.id] = p.nome_completo; });
      }

      const timeline: TimelineEvent[] = [];

      // Admissão
      if (employee?.data_admissao) {
        timeline.push({
          id: "admissao-" + employee.data_admissao,
          date: employee.data_admissao,
          type: "admissao",
          title: "Admissão na empresa",
          description: `Cargo: ${employee.cargo}${employee.setor ? ` | Setor: ${employee.setor}` : ""}`,
          icon: <UserPlus className="w-4 h-4 text-white" />,
          color: typeConfig.admissao.color,
        });
      }

      // Desligamento
      if (employee?.data_desligamento) {
        timeline.push({
          id: "desligamento-" + employee.data_desligamento,
          date: employee.data_desligamento,
          type: "desligamento",
          title: "Desligamento",
          icon: <UserMinus className="w-4 h-4 text-white" />,
          color: typeConfig.desligamento.color,
        });
      }

      // Férias
      (feriasRes.data || []).forEach((f: any) => {
        const inicio = f.periodo_gozo_inicio || f.data_inicio;
        if (!inicio) return;
        timeline.push({
          id: "ferias-" + f.id,
          date: inicio,
          type: "ferias",
          title: "Período de Férias",
          description: `${formatDate(inicio)} a ${formatDate(f.periodo_gozo_fim || f.data_fim)}${f.dias_vendidos ? ` (${f.dias_vendidos} dias vendidos)` : ""}`,
          icon: <Calendar className="w-4 h-4 text-white" />,
          color: typeConfig.ferias.color,
        });
      });

      // Reajustes
      (reajustesRes.data || []).forEach((r: any) => {
        timeline.push({
          id: "reajuste-" + r.id,
          date: r.aplicado_em?.split("T")[0] || r.created_at?.split("T")[0],
          type: "reajuste",
          title: "Reajuste Salarial",
          description: `R$ ${Number(r.salario_anterior).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} → R$ ${Number(r.salario_novo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${r.percentual_reajuste ? ` (${Number(r.percentual_reajuste).toFixed(1)}%)` : ""} — ${r.justificativa}`,
          icon: <TrendingUp className="w-4 h-4 text-white" />,
          color: typeConfig.reajuste.color,
        });
      });

      // Afastamentos
      (afastamentosRes.data || []).forEach((a: any) => {
        timeline.push({
          id: "afastamento-" + a.id,
          date: a.data_inicio,
          type: "afastamento",
          title: "Afastamento",
          description: `${a.motivo} — ${formatDate(a.data_inicio)} a ${formatDate(a.data_fim)}${a.cid ? ` (CID: ${a.cid})` : ""}`,
          icon: <AlertTriangle className="w-4 h-4 text-white" />,
          color: typeConfig.afastamento.color,
        });
      });

      // Faltas
      (faltasRes.data || []).forEach((f: any) => {
        timeline.push({
          id: "falta-" + f.id,
          date: f.data,
          type: "falta",
          title: "Falta",
          description: `${f.justificada ? "Justificada" : "Não justificada"}${f.motivo ? ` — ${f.motivo}` : ""}`,
          icon: <Clock className="w-4 h-4 text-white" />,
          color: typeConfig.falta.color,
        });
      });

      // Folgas
      (folgasRes.data || []).forEach((f: any) => {
        timeline.push({
          id: "folga-" + f.id,
          date: f.data,
          type: "folga",
          title: "Folga",
          description: f.motivo || undefined,
          icon: <FileText className="w-4 h-4 text-white" />,
          color: typeConfig.folga.color,
        });
      });

      // Alterações de cadastro (função, setor, salário, gestor…)
      ((alteracoesRes.data || []) as any[]).forEach((a) => {
        // Reajuste salarial do mesmo dia já aparece pelo histórico de reajustes
        const quando = new Date(a.alterado_em);
        if (a.campo === "salario" && (reajustesRes.data || []).some((r: any) => r.aplicado_em && toISODateLocal(new Date(r.aplicado_em)) === toISODateLocal(quando))) return;
        const hora = quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        timeline.push({
          id: "alteracao-" + a.id,
          date: toISODateLocal(quando),
          type: "alteracao",
          title: `${NOME_CAMPO[a.campo] || a.campo} alterado`,
          description: `${valorAlteracao(a.campo, a.valor_anterior)} → ${valorAlteracao(a.campo, a.valor_novo)} · ${hora}${a.alterado_por ? ` · por ${nomesAutores[a.alterado_por] || "usuário do sistema"}` : " · automático"}`,
          icon: <PenLine className="w-4 h-4 text-white" />,
          color: typeConfig.alteracao.color,
        });
      });

      // Ordenar do mais recente ao mais antigo
      timeline.sort((a, b) => b.date.localeCompare(a.date));
      setEvents(timeline);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum evento registrado para este funcionário.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="w-5 h-5" />
          Histórico Completo
          <Badge variant="secondary" className="ml-2">{events.length} eventos</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Linha vertical */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-6">
            {events.map((event) => (
              <div key={event.id} className="relative flex gap-4 items-start">
                {/* Ícone */}
                <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full ${event.color} shrink-0 shadow-sm`}>
                  {event.icon}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{event.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {typeConfig[event.type]?.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDate(event.date)}
                    </span>
                  </div>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HistoricoTimelineTab;

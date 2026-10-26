import { useState, useEffect } from "react";
import { todayISO, dataBR } from "@/lib/date";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  UserCircle,
  LogOut,
  Shield,
  Shirt,
  Bell,
  Calendar,
  Clock,
  Wallet,
  Receipt,
  FileText,
  Download,
  Paperclip,
  AlertTriangle,
  Megaphone,
  Info,
  Check,
  Eye,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { VacationProgress } from "@/components/ui/vacation-progress";
import PendingSignaturesAlert from "./PendingSignaturesAlert";
import PendingHoleritesAlert from "./PendingHoleritesAlert";
import { TreinamentosCard } from "./TreinamentosCard";
import TacCard from "@/components/tac/TacCard";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const prioridadeConfig: Record<string, { label: string; borderColor: string; bgColor: string }> = {
  baixa: { label: "Baixa", borderColor: "border-green-500", bgColor: "bg-green-500/10" },
  media: { label: "Média", borderColor: "border-yellow-500", bgColor: "bg-yellow-500/10" },
  alta: { label: "Alta", borderColor: "border-orange-500", bgColor: "bg-orange-500/10" },
  urgente: { label: "Urgente", borderColor: "border-red-500", bgColor: "bg-red-500/10" },
};

const categoriaIcons: Record<string, any> = {
  comunicado: Megaphone,
  lembrete: Calendar,
  alerta: AlertTriangle,
  evento: Calendar,
  rh: FileText,
  info: Info,
};

const formatDecimalToHoursMinutes = (decimal: number): string => {
  const sign = decimal < 0 ? "-" : "";
  const absDecimal = Math.abs(decimal);
  const hours = Math.floor(absDecimal);
  const minutes = Math.round((absDecimal - hours) * 60);
  return `${sign}${hours}h${minutes.toString().padStart(2, "0")}min`;
};

interface VisibilitySettings {
  avisos_visivel: boolean;
  saldo_horas_visivel: boolean;
  banco_horas_visivel: boolean;
  folgas_visivel: boolean;
  treinamentos_visivel: boolean;
  epis_visivel: boolean;
  uniformes_visivel: boolean;
  ferias_visivel: boolean;
  holerite_visivel: boolean;
  tacs_visivel: boolean;
  tipos_contrato_permitidos: string[];
}

interface FuncionarioDashboardProps {
  user: User;
}

const FuncionarioDashboard = ({ user }: FuncionarioDashboardProps) => {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<any>(null);
  const [epis, setEpis] = useState<any[]>([]);
  const [uniformes, setUniformes] = useState<any[]>([]);
  const [avisos, setAvisos] = useState<any[]>([]);
  const [avisosLidos, setAvisosLidos] = useState<Set<string>>(new Set());
  const [holerites, setHolerites] = useState<any[]>([]);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [horasMesAnterior, setHorasMesAnterior] = useState<number | null>(null);
  const [bancoHoras, setBancoHoras] = useState<number>(0);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [activeVacation, setActiveVacation] = useState<any>(null);
  const [visibility, setVisibility] = useState<VisibilitySettings>({
    avisos_visivel: true,
    saldo_horas_visivel: true,
    banco_horas_visivel: true,
    folgas_visivel: true,
    treinamentos_visivel: true,
    epis_visivel: true,
    uniformes_visivel: true,
    ferias_visivel: true,
    holerite_visivel: true,
    tacs_visivel: true,
    tipos_contrato_permitidos: ['fixo', 'intermitente', 'prestador_servico'],
  });

  useEffect(() => {
    fetchEmployeeData();
    fetchVisibilitySettings();
  }, [user]);

  const fetchVisibilitySettings = async () => {
    try {
      const { data } = await supabase
        .from("configuracoes_dashboard_funcionario")
        .select("*")
        .limit(1)
        .single();

      if (data) {
        setVisibility({
          avisos_visivel: data.avisos_visivel,
          saldo_horas_visivel: data.saldo_horas_visivel,
          banco_horas_visivel: data.banco_horas_visivel,
          folgas_visivel: data.folgas_visivel,
          treinamentos_visivel: data.treinamentos_visivel,
          epis_visivel: data.epis_visivel,
          uniformes_visivel: data.uniformes_visivel,
          ferias_visivel: data.ferias_visivel ?? true,
          holerite_visivel: data.holerite_visivel ?? true,
          tacs_visivel: data.tacs_visivel ?? true,
          tipos_contrato_permitidos: data.tipos_contrato_permitidos || ['fixo', 'intermitente', 'prestador_servico'],
        });
      }
    } catch (error) {
      console.error("Error fetching visibility settings:", error);
    }
  };

  const fetchEmployeeData = async () => {
    try {
      const { data: empData } = await supabase
        .from("employees")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (empData) {
        setEmployee(empData);
        
        // Check access based on contract type
        const { data: configData } = await supabase
          .from("configuracoes_dashboard_funcionario")
          .select("tipos_contrato_permitidos")
          .limit(1)
          .single();
        
        const allowedTypes = configData?.tipos_contrato_permitidos || ['fixo', 'intermitente', 'prestador_servico'];
        const employeeContractType = empData.tipo_contrato || 'fixo';
        
        if (!allowedTypes.includes(employeeContractType)) {
          setHasAccess(false);
          return;
        }
        
        setHasAccess(true);

        const [episRes, uniformesRes, avisosRes, feriasRes, companyRes, holeritesRes] = await Promise.all([
          supabase.from("epis").select("*").eq("employee_id", empData.id),
          supabase.from("uniformes").select("*").eq("employee_id", empData.id),
          supabase
            .from("avisos")
            .select("*")
            .contains("setores", [empData.setor])
            .gte("data_expiracao", todayISO())
            .order("created_at", { ascending: false }),
          supabase
            .from("ferias")
            .select("*")
            .eq("employee_id", empData.id)
            .eq("data_retorno_confirmada", false)
            .gte("periodo_gozo_fim", todayISO())
            .order("periodo_gozo_inicio", { ascending: false })
            .limit(1)
            .maybeSingle(),
          empData.empresa_id 
            ? supabase.from("empresas").select("logo_url").eq("id", empData.empresa_id).maybeSingle()
            : Promise.resolve({ data: null }),
          supabase
            .from("folha_pagamento")
            .select(`
              *,
              folha_pagamento_itens (
                id,
                variavel_id,
                valor,
                variaveis_folha (id, nome, codigo, tipo)
              )
            `)
            .eq("employee_id", empData.id)
            .order("ano", { ascending: false })
            .order("mes", { ascending: false })
            .limit(12)
        ]);

        setEpis(episRes.data || []);
        setUniformes(uniformesRes.data || []);
        setAvisos(avisosRes.data || []);
        setActiveVacation(feriasRes.data || null);
        setCompanyLogo(companyRes.data?.logo_url || null);
        setHolerites(holeritesRes.data || []);

        // Buscar avisos já lidos
        if (avisosRes.data && avisosRes.data.length > 0) {
          const { data: leiturasData } = await supabase
            .from("avisos_leituras")
            .select("aviso_id")
            .eq("employee_id", empData.id);
          
          if (leiturasData) {
            setAvisosLidos(new Set(leiturasData.map(l => l.aviso_id)));
          }
        }

        // Buscar horas do mês anterior
        const mesAnterior = subMonths(new Date(), 1);
        const startDate = format(startOfMonth(mesAnterior), "yyyy-MM-dd");
        const endDate = format(endOfMonth(mesAnterior), "yyyy-MM-dd");

        const { data: registrosMesAnterior } = await supabase
          .from("registros_ponto")
          .select("*")
          .eq("employee_id", empData.id)
          .gte("data", startDate)
          .lte("data", endDate);

        const { data: config } = await supabase
          .from("configuracao_horas_trabalho")
          .select("*")
          .eq("employee_id", empData.id)
          .maybeSingle();

        if (registrosMesAnterior) {
          const horasDiarias = config?.horas_diarias_esperadas || 8.00;
          const diasUteis = registrosMesAnterior.filter(r => r.tipo_dia === "normal").length;
          const horasEsperadas = diasUteis * horasDiarias;
          const horasTrabalhadas = registrosMesAnterior.reduce((sum, r) => sum + (r.horas_trabalhadas || 0), 0);
          const saldo = horasTrabalhadas - horasEsperadas;
          setHorasMesAnterior(saldo);
        }

        // Buscar banco de horas
        const { data: bancoData } = await supabase
          .from("banco_horas")
          .select("*")
          .eq("employee_id", empData.id)
          .maybeSingle();

        setBancoHoras(bancoData?.saldo_horas || 0);
      }
    } catch (error) {
      console.error("Error fetching employee data:", error);
    }
  };

  const calculateVacationProgress = () => {
    if (!activeVacation) return null;

    const startDate = dataBR(activeVacation.periodo_gozo_inicio);
    const endDate = dataBR(activeVacation.periodo_gozo_fim);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysPassed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = activeVacation.dias_totais - daysPassed;

    const progress = Math.min(100, Math.max(0, (daysPassed / activeVacation.dias_totais) * 100));
    
    const realVacationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const timeOffDays = activeVacation.dias_totais - realVacationDays;

    return { 
      progress, 
      daysRemaining: Math.max(0, daysRemaining), 
      totalDays: activeVacation.dias_totais,
      vacationDays: realVacationDays,
      timeOffDays 
    };
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erro ao sair");
    } else {
      navigate("/auth");
    }
  };


  if (hasAccess === null || !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (hasAccess === false) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {companyLogo ? (
                <div className="w-10 h-10 flex items-center justify-center">
                  <img src={companyLogo} alt="Logo" className="w-10 h-10 object-contain" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                  <UserCircle className="w-5 h-5 text-primary-foreground" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold">Meu Painel</h1>
                <p className="text-sm text-muted-foreground">{employee?.nome_completo}</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="border-destructive">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
              <p className="text-muted-foreground">
                Seu tipo de contrato não possui acesso ao painel do funcionário.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Entre em contato com o RH para mais informações.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PendingSignaturesAlert />
      <PendingHoleritesAlert />
      
      
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {companyLogo ? (
              <div className="w-10 h-10 flex items-center justify-center">
                <img src={companyLogo} alt="Logo" className="w-10 h-10 object-contain" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <UserCircle className="w-5 h-5 text-primary-foreground" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">Meu Painel</h1>
              <p className="text-sm text-muted-foreground">{employee.nome_completo}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
          {/* Vacation Progress */}
          {visibility.ferias_visivel && activeVacation && (() => {
            const vacationProgress = calculateVacationProgress();
            if (vacationProgress && vacationProgress.daysRemaining > 0) {
              return (
                <Card className="border-primary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Férias em Andamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Retorno previsto</span>
                      <span className="font-medium">
                        {dataBR(activeVacation.periodo_gozo_fim).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Dias restantes</span>
                        <span className="font-bold text-lg">
                          {vacationProgress.daysRemaining} {vacationProgress.daysRemaining === 1 ? 'dia' : 'dias'}
                        </span>
                      </div>
                      <VacationProgress 
                        totalDays={vacationProgress.totalDays}
                        daysPassed={vacationProgress.totalDays - vacationProgress.daysRemaining}
                        vacationDays={vacationProgress.vacationDays}
                        timeOffDays={vacationProgress.timeOffDays}
                        className="h-3"
                      />
                      {vacationProgress.timeOffDays > 0 && (
                        <div className="flex gap-2 text-xs text-muted-foreground justify-center">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-secondary" />
                            <span>Férias ({vacationProgress.vacationDays})</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-warning" />
                            <span>Folgas ({vacationProgress.timeOffDays})</span>
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground text-center">
                        {Math.round(vacationProgress.progress)}% concluído
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            }
            return null;
          })()}

          {/* TACs */}
          {visibility.tacs_visivel && <TacCard employeeId={employee.id} />}

          {/* Avisos */}
          {visibility.avisos_visivel && avisos.length > 0 && (
            <div className="space-y-3">
              {avisos
                .sort((a, b) => {
                  const prioridadeOrder: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
                  return (prioridadeOrder[a.prioridade] || 2) - (prioridadeOrder[b.prioridade] || 2);
                })
                .map((aviso) => {
                  const prioridade = prioridadeConfig[aviso.prioridade] || prioridadeConfig.media;
                  const CategoriaIcon = categoriaIcons[aviso.categoria] || Bell;
                  const isLido = avisosLidos.has(aviso.id);

                  const marcarComoLido = async () => {
                    if (isLido) return;
                    try {
                      await supabase.from("avisos_leituras").insert({
                        aviso_id: aviso.id,
                        employee_id: employee.id,
                      });
                      setAvisosLidos(prev => new Set(prev).add(aviso.id));
                    } catch (error) {
                      console.error("Error marking as read:", error);
                    }
                  };

                  return (
                    <Alert 
                      key={aviso.id} 
                      className={`${prioridade.borderColor} ${prioridade.bgColor} ${isLido ? 'opacity-75' : ''}`}
                    >
                      <CategoriaIcon className="h-5 w-5" />
                      <AlertTitle className="font-semibold text-lg flex items-center gap-2 flex-wrap">
                        <span className="capitalize">{aviso.categoria || "Aviso"}</span>
                        <Badge variant={aviso.prioridade === "urgente" ? "destructive" : "outline"} className="text-xs">
                          {prioridade.label}
                        </Badge>
                        {isLido && (
                          <Badge variant="secondary" className="text-xs">
                            <Check className="w-3 h-3 mr-1" />
                            Lido
                          </Badge>
                        )}
                      </AlertTitle>
                      <AlertDescription className="text-base mt-2">
                        {aviso.mensagem}
                        <div className="flex flex-wrap items-center gap-3 mt-3">
                          <span className="text-xs text-muted-foreground">
                            Válido até: {dataBR(aviso.data_expiracao).toLocaleDateString("pt-BR")}
                          </span>
                          {aviso.anexo_url && (
                            <a 
                              href={aviso.anexo_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <Paperclip className="w-3 h-3" />
                              Ver anexo
                            </a>
                          )}
                          {!isLido && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={marcarComoLido}
                              className="text-xs h-6"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Marcar como lido
                            </Button>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  );
                })}
            </div>
          )}

          {/* Cards de Horas */}
          {(visibility.saldo_horas_visivel || visibility.banco_horas_visivel) && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Horas do Mês Anterior */}
              {visibility.saldo_horas_visivel && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Saldo de Horas - Mês Anterior
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {horasMesAnterior !== null ? (
                      <div className="space-y-2">
                        <div className={`text-3xl font-bold ${
                          horasMesAnterior > 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : horasMesAnterior < 0 
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-muted-foreground'
                        }`}>
                          {horasMesAnterior > 0 ? '+' : ''}{formatDecimalToHoursMinutes(horasMesAnterior)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(subMonths(new Date(), 1), "MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        Sem registros
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Banco de Horas */}
              {visibility.banco_horas_visivel && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="w-5 h-5" />
                      Banco de Horas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className={`text-3xl font-bold ${
                        bancoHoras > 0 
                          ? 'text-primary' 
                          : 'text-muted-foreground'
                      }`}>
                        {formatDecimalToHoursMinutes(bancoHoras)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Horas acumuladas
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Card de Folgas */}
          {visibility.folgas_visivel && (
            <Card>
              <CardHeader>
                <CardTitle>Folgas Disponíveis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  {employee.quantidade_folgas || 0} folgas
                </div>
              </CardContent>
            </Card>
          )}

          {/* Treinamentos */}
          {visibility.treinamentos_visivel && <TreinamentosCard employeeId={employee.id} />}

          {/* EPIs */}
          {visibility.epis_visivel && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  EPIs Recebidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {epis.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum EPI registrado.</p>
                ) : (
                  <div className="space-y-3">
                    {epis.map((epi) => (
                      <div key={epi.id} className="border-b pb-3 last:border-0">
                        <p className="font-medium">{epi.tipo_epi}</p>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                          <span>Qtd: {epi.quantidade}</span>
                          <span>
                            Data: {dataBR(epi.data_entrega).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        {epi.observacoes && (
                          <p className="text-sm mt-1">{epi.observacoes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Uniformes */}
          {visibility.uniformes_visivel && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shirt className="w-5 h-5" />
                  Uniformes Recebidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {uniformes.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum uniforme registrado.</p>
                ) : (
                  <div className="space-y-3">
                    {uniformes.map((uniforme) => (
                      <div key={uniforme.id} className="border-b pb-3 last:border-0">
                        <p className="font-medium">{uniforme.tipo_uniforme}</p>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                          <span>Tamanho: {uniforme.tamanho}</span>
                          <span>Qtd: {uniforme.quantidade}</span>
                          <span>
                            Data: {dataBR(uniforme.data_entrega).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        {uniforme.observacoes && (
                          <p className="text-sm mt-1">{uniforme.observacoes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Holerites */}
          {visibility.holerite_visivel && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Meus Holerites
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => navigate("/meus-holerites")}
                  className="w-full mb-3"
                  variant="outline"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Acessar Meus Holerites (Assinar / Baixar Certificado)
                </Button>
                {holerites.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum holerite disponível.</p>
                ) : (
                  <div className="space-y-3">
                    {holerites.map((holerite) => {
                      const mesNome = new Date(holerite.ano, holerite.mes - 1).toLocaleString("pt-BR", { month: "long" });
                      const tipoLabel = {
                        salario: "Folha de Salário",
                        complementar: "Complementar",
                        adiantamento: "Adiantamento",
                        decimo_terceiro: "13º Salário",
                      }[holerite.tipo_folha as string] || holerite.tipo_folha;

                      return (
                        <div key={holerite.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {mesNome.charAt(0).toUpperCase() + mesNome.slice(1)} / {holerite.ano}
                              </p>
                              <p className="text-sm text-muted-foreground">{tipoLabel}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg">
                                R$ {Number(holerite.valor_liquido).toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">Valor Líquido</p>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Bruto:</span>{" "}
                                <span className="font-medium">R$ {Number(holerite.valor_bruto).toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Descontos:</span>{" "}
                                <span className="font-medium text-destructive">
                                  R$ {((holerite.desconto || 0) + (holerite.folha_pagamento_itens || [])
                                    .filter((i: any) => i.variaveis_folha?.tipo === "desconto")
                                    .reduce((sum: number, i: any) => sum + i.valor, 0)).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default FuncionarioDashboard;

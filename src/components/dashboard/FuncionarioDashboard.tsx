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
  ArrowLeft,
  CalendarCheck,
  Palmtree,
  GraduationCap,
  HardHat,
  Stethoscope,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import EnviarAtestado from "@/components/portal/EnviarAtestado";
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
  user?: User;
  /** RH vendo o painel de um colaborador (só visualização) */
  previewEmployeeId?: string;
}

const FuncionarioDashboard = ({ user, previewEmployeeId }: FuncionarioDashboardProps) => {
  const preview = !!previewEmployeeId;
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
  }, [user, previewEmployeeId]);

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
        .eq(preview ? "id" : "user_id", preview ? previewEmployeeId! : user!.id)
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
          Promise.resolve({ data: [] as any[] }), // holerites do portal: só os PDFs (Meus Holerites)
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
    if (preview) { navigate("/dashboard#funcionarios"); return; }
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erro ao sair");
    } else {
      navigate("/auth");
    }
  };

  // Navegação interna: cada atalho abre uma tela própria (#holerites, #avisos…), e o "voltar" do celular funciona
  const [secao, setSecao] = useState<string>(() => window.location.hash.replace("#", ""));
  useEffect(() => {
    const aoMudar = () => { setSecao(window.location.hash.replace("#", "")); window.scrollTo({ top: 0 }); };
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, []);
  const abrir = (s: string) => { window.location.hash = s; };
  const voltar = () => {
    if (window.history.length > 1 && secao) window.history.back();
    else { history.replaceState(null, "", window.location.pathname); setSecao(""); }
  };

  if (hasAccess === null || !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const primeiroNome = String(employee.nome_completo || "").split(" ")[0];
  const nomeBonito = primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase();
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const iniciais = String(employee.nome_completo || "").split(" ").filter(Boolean).map((p: string, i: number, a: string[]) => (i === 0 || i === a.length - 1 ? p[0] : "")).join("").toUpperCase();

  const Cabecalho = ({ compacto }: { compacto?: boolean }) => (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2.5">
            {companyLogo
              ? <img src={companyLogo} alt="Logo da empresa" className="h-8 w-auto object-contain" />
              : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">C</span>}
            <span className="text-sm font-medium">Meu painel</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
            <LogOut className="h-4 w-4" />{preview ? "Sair da visualização" : "Sair"}
          </Button>
        </div>
      </header>
      {!compacto && (
        <div className="mx-auto max-w-3xl px-4 pt-5">
          <div className="flex items-center gap-4 rounded-lg border-l-4 border-l-primary bg-card p-4 shadow-[0_1px_2px_rgba(20,24,40,0.06)]">
            <div className="relative shrink-0">
              <Avatar className="h-14 w-14">
                <AvatarImage src={employee.foto_url || undefined} alt="" className="object-cover" />
                <AvatarFallback className="bg-muted text-base font-bold text-muted-foreground">{iniciais}</AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{saudacao},</p>
              <h1 className="truncate text-xl font-medium leading-tight">{nomeBonito}</h1>
              <p className="truncate text-xs text-muted-foreground">{[employee.cargo, employee.setor].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (hasAccess === false) {
    return (
      <div className="min-h-screen bg-background">
        <Cabecalho />
        <main className="mx-auto max-w-3xl px-4 pb-8 pt-5">
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <Shield className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="mb-2 text-xl font-semibold">Acesso restrito</h2>
              <p className="text-muted-foreground">Seu tipo de contrato não tem acesso ao painel. Fale com o RH para mais informações.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // ---------- dados derivados ----------
  const hoje = todayISO();
  const feriasEmCurso = activeVacation && activeVacation.periodo_gozo_inicio <= hoje ? activeVacation : null;
  const feriasMarcadas = activeVacation && activeVacation.periodo_gozo_inicio > hoje ? activeVacation : null;
  const progressoFerias = feriasEmCurso ? calculateVacationProgress() : null;
  const ordemPrioridade: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
  const avisosOrdenados = [...avisos].sort((a, b) => {
    const lidoA = avisosLidos.has(a.id) ? 1 : 0, lidoB = avisosLidos.has(b.id) ? 1 : 0;
    if (lidoA !== lidoB) return lidoA - lidoB;
    return (ordemPrioridade[a.prioridade] ?? 2) - (ordemPrioridade[b.prioridade] ?? 2);
  });
  const naoLidos = avisos.filter((a) => !avisosLidos.has(a.id));
  const dataCurta = (d: string) => dataBR(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  const marcarComoLido = async (aviso: any) => {
    if (preview) { toast.info("Na visualização do RH nada é marcado em nome do colaborador."); return; }
    if (avisosLidos.has(aviso.id)) return;
    const { error } = await supabase.from("avisos_leituras").insert({ aviso_id: aviso.id, employee_id: employee.id });
    if (!error) setAvisosLidos((prev) => new Set(prev).add(aviso.id));
  };

  const CartaoAviso = ({ aviso }: { aviso: any }) => {
    const prioridade = prioridadeConfig[aviso.prioridade] || prioridadeConfig.media;
    const CategoriaIcon = categoriaIcons[aviso.categoria] || Bell;
    const lido = avisosLidos.has(aviso.id);
    return (
      <div className={`rounded-lg border-l-4 bg-card p-4 shadow-[0_1px_2px_rgba(20,24,40,0.06)] ${prioridade.borderColor} ${lido ? "opacity-70" : ""}`}>
        <div className="flex items-start gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${prioridade.bgColor}`}><CategoriaIcon className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold capitalize">{aviso.categoria || "Aviso"}</span>
              {(aviso.prioridade === "urgente" || aviso.prioridade === "alta") && <Badge variant={aviso.prioridade === "urgente" ? "destructive" : "outline"} className="text-xs">{prioridade.label}</Badge>}
              {lido && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Check className="h-3 w-3" />Lido</span>}
            </div>
            <p className="mt-1 whitespace-pre-line break-words text-[15px] leading-relaxed">{aviso.mensagem}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {aviso.anexo_url && (
                <a href={aviso.anexo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  <Paperclip className="h-4 w-4" />Ver anexo
                </a>
              )}
              {!lido && (
                <Button variant="outline" size="sm" onClick={() => marcarComoLido(aviso)} className="h-8">
                  <Eye className="mr-1 h-4 w-4" />Marcar como lido
                </Button>
              )}
              <span className="ml-auto text-xs text-muted-foreground">até {dataCurta(aviso.data_expiracao)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const resumo: { rotulo: string; valor: string; detalhe?: string; cor?: string; faixa?: string; icone: any }[] = [];
  if (visibility.folgas_visivel) resumo.push({ rotulo: "Folgas", valor: String(employee.quantidade_folgas || 0), detalhe: "disponíveis", faixa: "border-l-primary", icone: CalendarCheck });
  if (visibility.banco_horas_visivel) resumo.push({ rotulo: "Banco de horas", valor: formatDecimalToHoursMinutes(bancoHoras), detalhe: "acumuladas", faixa: "border-l-violet-400", icone: Wallet });
  if (visibility.saldo_horas_visivel) resumo.push({
    rotulo: "Saldo do mês",
    valor: horasMesAnterior === null ? "—" : `${horasMesAnterior > 0 ? "+" : ""}${formatDecimalToHoursMinutes(horasMesAnterior)}`,
    detalhe: format(subMonths(new Date(), 1), "MMMM", { locale: ptBR }),
    cor: horasMesAnterior === null || horasMesAnterior === 0 ? undefined : horasMesAnterior > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
    faixa: "border-l-amber-400",
    icone: Clock,
  });
  if (visibility.ferias_visivel) resumo.push({
    rotulo: "Férias",
    valor: feriasEmCurso ? "Agora" : feriasMarcadas ? dataCurta(feriasMarcadas.periodo_gozo_inicio) : "—",
    detalhe: feriasEmCurso ? `volta ${dataCurta(feriasEmCurso.periodo_gozo_fim)}` : feriasMarcadas ? "próximas férias" : "nada marcado",
    faixa: "border-l-emerald-500",
    icone: Palmtree,
  });

  const atalhos: { chave: string; titulo: string; sub: string; icone: any; cor: string; contador?: number; acao?: () => void }[] = [];
  if (visibility.holerite_visivel) atalhos.push({ chave: "holerites", titulo: "Holerites", sub: "Ver, baixar e assinar", icone: Receipt, cor: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300", acao: () => navigate(preview ? `/meus-holerites?colaborador=${employee.id}` : "/meus-holerites") });
  atalhos.push({ chave: "atestado", titulo: "Enviar atestado", sub: "Foto pelo celular", icone: Stethoscope, cor: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" });
  if (visibility.avisos_visivel) atalhos.push({ chave: "avisos", titulo: "Avisos", sub: naoLidos.length ? `${naoLidos.length} não lido${naoLidos.length > 1 ? "s" : ""}` : "Tudo lido", icone: Megaphone, cor: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", contador: naoLidos.length });
  if (visibility.treinamentos_visivel) atalhos.push({ chave: "treinamentos", titulo: "Treinamentos", sub: "Cursos e certificados", icone: GraduationCap, cor: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" });
  if (visibility.epis_visivel) atalhos.push({ chave: "epis", titulo: "EPIs", sub: `${epis.length} recebido${epis.length === 1 ? "" : "s"}`, icone: HardHat, cor: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" });
  if (visibility.uniformes_visivel) atalhos.push({ chave: "uniformes", titulo: "Uniformes", sub: `${uniformes.length} recebido${uniformes.length === 1 ? "" : "s"}`, icone: Shirt, cor: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" });

  const TelaSecao = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
    <div className="min-h-screen bg-background">
      <Cabecalho compacto />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4 pb-10">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={voltar} className="-ml-2"><ArrowLeft className="mr-1 h-4 w-4" />Início</Button>
        </div>
        <h2 className="text-xl font-medium">{titulo}</h2>
        {children}
      </main>
    </div>
  );

  const ListaVazia = ({ texto }: { texto: string }) => <Card><CardContent className="py-10 text-center text-muted-foreground">{texto}</CardContent></Card>;

  // ---------- telas internas ----------
  if (secao === "avisos" && visibility.avisos_visivel) return (
    <TelaSecao titulo="Avisos">
      {avisosOrdenados.length === 0 ? <ListaVazia texto="Nenhum aviso no momento." /> : <div className="space-y-3">{avisosOrdenados.map((a) => <CartaoAviso key={a.id} aviso={a} />)}</div>}
    </TelaSecao>
  );
  if (secao === "atestado") return (
    <TelaSecao titulo="Enviar atestado">
      {preview && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Visualização do RH: o envio fica bloqueado, só aparecem os atestados já enviados.</p>}
      <EnviarAtestado employeeId={employee.id} somenteLeitura={preview} />
    </TelaSecao>
  );
  if (secao === "treinamentos" && visibility.treinamentos_visivel) return (
    <TelaSecao titulo="Treinamentos"><TreinamentosCard employeeId={employee.id} /></TelaSecao>
  );
  if (secao === "epis" && visibility.epis_visivel) return (
    <TelaSecao titulo="EPIs recebidos">
      {epis.length === 0 ? <ListaVazia texto="Nenhum EPI registrado." /> : (
        <Card><CardContent className="divide-y p-0">
          {epis.map((epi) => (
            <div key={epi.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{epi.tipo_epi}</p>
                <span className="shrink-0 text-sm text-muted-foreground">{dataBR(epi.data_entrega).toLocaleDateString("pt-BR")}</span>
              </div>
              <p className="text-sm text-muted-foreground">Quantidade: {epi.quantidade}</p>
              {epi.observacoes && <p className="mt-1 text-sm">{epi.observacoes}</p>}
            </div>
          ))}
        </CardContent></Card>
      )}
    </TelaSecao>
  );
  if (secao === "uniformes" && visibility.uniformes_visivel) return (
    <TelaSecao titulo="Uniformes recebidos">
      {uniformes.length === 0 ? <ListaVazia texto="Nenhum uniforme registrado." /> : (
        <Card><CardContent className="divide-y p-0">
          {uniformes.map((u) => (
            <div key={u.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{u.tipo_uniforme}</p>
                <span className="shrink-0 text-sm text-muted-foreground">{dataBR(u.data_entrega).toLocaleDateString("pt-BR")}</span>
              </div>
              <p className="text-sm text-muted-foreground">Tamanho {u.tamanho} · Quantidade: {u.quantidade}</p>
              {u.observacoes && <p className="mt-1 text-sm">{u.observacoes}</p>}
            </div>
          ))}
        </CardContent></Card>
      )}
    </TelaSecao>
  );
  // ---------- tela inicial ----------
  return (
    <div className="min-h-screen bg-background">
      <Cabecalho />
      <main className="mx-auto max-w-3xl space-y-5 px-4 pb-10 pt-5">
        {!preview && <PendingSignaturesAlert />}
        {!preview && <PendingHoleritesAlert />}

        {visibility.ferias_visivel && feriasEmCurso && progressoFerias && progressoFerias.daysRemaining > 0 && (
          <div className="space-y-3 rounded-lg border-l-4 border-l-emerald-500 bg-card p-5 shadow-[0_1px_2px_rgba(20,24,40,0.06)]">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-emerald-700"><Palmtree className="h-4 w-4" />Você está de férias</div>
            <p className="text-2xl font-medium">Faltam {progressoFerias.daysRemaining} {progressoFerias.daysRemaining === 1 ? "dia" : "dias"}</p>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progressoFerias.progress}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">Retorno previsto: {dataBR(feriasEmCurso.periodo_gozo_fim).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p>
          </div>
        )}

        {resumo.length > 0 && (
          <div className={`grid gap-3 ${resumo.length === 1 ? "grid-cols-1" : "grid-cols-2"} ${resumo.length >= 4 ? "sm:grid-cols-4" : ""}`}>
            {resumo.map((r) => (
              <div key={r.rotulo} className={`rounded-lg border-l-4 ${r.faixa || "border-l-slate-300"} bg-card p-4 shadow-[0_1px_2px_rgba(20,24,40,0.06)]`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{r.rotulo}</p>
                <p className={`mt-1 truncate text-2xl font-medium tabular-nums ${r.cor || ""}`}>{r.valor}</p>
                {r.detalhe && <p className="truncate text-xs text-muted-foreground">{r.detalhe}</p>}
              </div>
            ))}
          </div>
        )}

        {visibility.tacs_visivel && <TacCard employeeId={employee.id} />}

        {visibility.avisos_visivel && naoLidos.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground"><Bell className="h-3.5 w-3.5" />Avisos novos</h2>
              {avisos.length > 2 && <Button variant="link" size="sm" className="px-0" onClick={() => abrir("avisos")}>Ver todos</Button>}
            </div>
            {avisosOrdenados.filter((a) => !avisosLidos.has(a.id)).slice(0, 2).map((a) => <CartaoAviso key={a.id} aviso={a} />)}
          </section>
        )}

        {atalhos.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Acesso rápido</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {atalhos.map((a) => (
                <button
                  key={a.chave}
                  type="button"
                  onClick={a.acao || (() => abrir(a.chave))}
                  className="relative flex min-h-[108px] flex-col items-start justify-between rounded-lg bg-card p-4 text-left shadow-[0_1px_2px_rgba(20,24,40,0.06)] transition hover:shadow-[0_2px_8px_rgba(20,24,40,0.1)] active:scale-[0.98]"
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full ${a.cor}`}><a.icone className="h-5 w-5" /></span>
                  {!!a.contador && <span className="absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground">{a.contador}</span>}
                  <span className="mt-3 block w-full">
                    <span className="block font-semibold">{a.titulo}</span>
                    <span className="block truncate text-xs text-muted-foreground">{a.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default FuncionarioDashboard;

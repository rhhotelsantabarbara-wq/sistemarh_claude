import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import Auth from "./pages/Auth";
import AppLayout from "./components/layout/AppLayout";
import CarregandoTela from "./components/layout/CarregandoTela";
import { lazyComRetry } from "./lib/lazyComRetry";
import { Suspense } from "react";
import { FloatingAIChat } from "./components/ai/FloatingAIChat";

const Dashboard = lazyComRetry(() => import("./pages/Dashboard"));
const EmployeeDetails = lazyComRetry(() => import("./pages/EmployeeDetails"));
const Stock = lazyComRetry(() => import("./pages/Stock"));
const Afastamentos = lazyComRetry(() => import("./pages/Afastamentos"));
const DistribuirEpi = lazyComRetry(() => import("./pages/DistribuirEpi"));
const DistribuirUniforme = lazyComRetry(() => import("./pages/DistribuirUniforme"));
const Sectors = lazyComRetry(() => import("./pages/Sectors"));
const Turnover = lazyComRetry(() => import("./pages/Turnover"));
const Financeiro = lazyComRetry(() => import("./pages/Financeiro"));
const Companies = lazyComRetry(() => import("./pages/Companies"));
const Payroll = lazyComRetry(() => import("./pages/Payroll"));
const Funcoes = lazyComRetry(() => import("./pages/Funcoes"));
const Contracts = lazyComRetry(() => import("./pages/Contracts"));
const Managers = lazyComRetry(() => import("./pages/Managers"));
const AdminUsers = lazyComRetry(() => import("./pages/AdminUsers"));
const SalaryAdjustment = lazyComRetry(() => import("./pages/SalaryAdjustment"));
const ControlePonto = lazyComRetry(() => import("./pages/ControlePonto"));
const NotFound = lazyComRetry(() => import("./pages/NotFound"));
const Vagas = lazyComRetry(() => import("./pages/Vagas"));
const VagaDetalhes = lazyComRetry(() => import("./pages/VagaDetalhes"));
const Recrutamento = lazyComRetry(() => import("./pages/Recrutamento"));
const CandidaturasVaga = lazyComRetry(() => import("./pages/CandidaturasVaga"));
const Relatorios = lazyComRetry(() => import("./pages/Relatorios"));
const SaudeOcupacional = lazyComRetry(() => import("./pages/SaudeOcupacional"));
const VacationSchedule = lazyComRetry(() => import("./pages/VacationSchedule"));
const Settings = lazyComRetry(() => import("./pages/Settings"));
const Avaliacoes = lazyComRetry(() => import("./pages/Avaliacoes"));
const Treinamentos = lazyComRetry(() => import("./pages/Treinamentos"));
const Adiantamentos = lazyComRetry(() => import("./pages/Adiantamentos"));
const PlanoAdmissaoDesligamento = lazyComRetry(() => import("./pages/PlanoAdmissaoDesligamento"));
const AdmissaoDigital = lazyComRetry(() => import("./pages/AdmissaoDigital"));
const AdmissaoPublica = lazyComRetry(() => import("./pages/AdmissaoPublica"));
const PeopleManager = lazyComRetry(() => import("./pages/PeopleManager"));
const Tacs = lazyComRetry(() => import("./pages/Tacs"));
const Crachas = lazyComRetry(() => import("./pages/Crachas"));
const Eventos = lazyComRetry(() => import("./pages/Eventos"));
const AIInsights = lazyComRetry(() => import("./pages/AIInsights"));
const ConsultaJudicial = lazyComRetry(() => import("./pages/ConsultaJudicial"));
const Contabilidade = lazyComRetry(() => import("./pages/Contabilidade"));
const NR1Dashboard = lazyComRetry(() => import("./pages/nr1/Dashboard"));
const NR1PainelGerencial = lazyComRetry(() => import("./pages/nr1/PainelGerencial"));
const NR1AuditoriaMT = lazyComRetry(() => import("./pages/nr1/AuditoriaMT"));
const NR1Denuncias = lazyComRetry(() => import("./pages/nr1/Denuncias"));
const NR1Clima = lazyComRetry(() => import("./pages/nr1/Clima"));
const NR1Riscos = lazyComRetry(() => import("./pages/nr1/Riscos"));
const NR1Treinamentos = lazyComRetry(() => import("./pages/nr1/Treinamentos"));
const NR1Acoes = lazyComRetry(() => import("./pages/nr1/Acoes"));
const NR1Lideranca = lazyComRetry(() => import("./pages/nr1/Lideranca"));
const NR1LiderancaResponder = lazyComRetry(() => import("./pages/nr1/LiderancaResponder"));
const NR1Relatorios = lazyComRetry(() => import("./pages/nr1/Relatorios"));
const NR1Config = lazyComRetry(() => import("./pages/nr1/Config"));
const ClimaResponderPublic = lazyComRetry(() => import("./pages/public/ClimaResponder"));
const DenunciaPublica = lazyComRetry(() => import("./pages/public/DenunciaPublica"));
const Privacidade = lazyComRetry(() => import("./pages/public/Privacidade"));
const MeusHolerites = lazyComRetry(() => import("./pages/MeusHolerites"));
const ValidarHolerite = lazyComRetry(() => import("./pages/ValidarHolerite"));

const queryClient = new QueryClient();

const App = () => {
  useSiteSettings();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <FloatingAIChat />
            <Suspense fallback={<CarregandoTela telaCheia />}>
            <Routes>
              <Route path="/" element={<Auth />} />
              <Route path="/auth" element={<Auth />} />

              {/* All gestor routes wrapped in AppLayout */}
              <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
              <Route path="/employee/:id" element={<AppLayout><EmployeeDetails /></AppLayout>} />
              <Route path="/stock" element={<AppLayout><Stock /></AppLayout>} />
              <Route path="/distribuir-epi" element={<AppLayout><DistribuirEpi /></AppLayout>} />
              <Route path="/distribuir-uniforme" element={<AppLayout><DistribuirUniforme /></AppLayout>} />
              <Route path="/afastamentos" element={<AppLayout><Afastamentos /></AppLayout>} />
              <Route path="/sectors" element={<AppLayout><Sectors /></AppLayout>} />
              <Route path="/turnover" element={<AppLayout><Turnover /></AppLayout>} />
              <Route path="/financeiro" element={<AppLayout><Financeiro /></AppLayout>} />
              <Route path="/companies" element={<AppLayout><Companies /></AppLayout>} />
              <Route path="/payroll" element={<AppLayout><Payroll /></AppLayout>} />
              <Route path="/funcoes" element={<AppLayout><Funcoes /></AppLayout>} />
              <Route path="/contracts" element={<AppLayout><Contracts /></AppLayout>} />
              <Route path="/managers" element={<AppLayout><Managers /></AppLayout>} />
              <Route path="/admin-users" element={<AppLayout><AdminUsers /></AppLayout>} />
              <Route path="/salary-adjustment" element={<AppLayout><SalaryAdjustment /></AppLayout>} />
              <Route path="/vagas" element={<Vagas />} />
              <Route path="/vaga/:id" element={<VagaDetalhes />} />
              <Route path="/recrutamento" element={<AppLayout><Recrutamento /></AppLayout>} />
              <Route path="/recrutamento/vaga/:id/candidaturas" element={<AppLayout><CandidaturasVaga /></AppLayout>} />
              <Route path="/relatorios" element={<AppLayout><Relatorios /></AppLayout>} />
              <Route path="/saude-ocupacional" element={<AppLayout><SaudeOcupacional /></AppLayout>} />
              <Route path="/vacation-schedule" element={<AppLayout><VacationSchedule /></AppLayout>} />
              <Route path="/avaliacoes" element={<AppLayout><Avaliacoes /></AppLayout>} />
              <Route path="/controle-ponto" element={<AppLayout><ControlePonto /></AppLayout>} />
              <Route path="/treinamentos" element={<AppLayout><Treinamentos /></AppLayout>} />
              <Route path="/adiantamentos" element={<AppLayout><Adiantamentos /></AppLayout>} />
              <Route path="/plano-admissao-desligamento" element={<AppLayout><PlanoAdmissaoDesligamento /></AppLayout>} />
              <Route path="/admissao-digital" element={<AppLayout><AdmissaoDigital /></AppLayout>} />
              <Route path="/people-manager" element={<AppLayout><PeopleManager /></AppLayout>} />
              <Route path="/tacs" element={<AppLayout><Tacs /></AppLayout>} />
              <Route path="/crachas" element={<AppLayout><Crachas /></AppLayout>} />
              <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
              <Route path="/eventos" element={<AppLayout><Eventos /></AppLayout>} />
              <Route path="/ai-insights" element={<AppLayout><AIInsights /></AppLayout>} />
              <Route path="/consulta-judicial" element={<AppLayout><ConsultaJudicial /></AppLayout>} />
              <Route path="/contabilidade" element={<AppLayout><Contabilidade /></AppLayout>} />

              {/* NR-1 | Gestão Psicossocial */}
              <Route path="/nr1/dashboard" element={<AppLayout><NR1Dashboard /></AppLayout>} />
              <Route path="/nr1/painel" element={<AppLayout><NR1PainelGerencial /></AppLayout>} />
              <Route path="/nr1/denuncias" element={<AppLayout><NR1Denuncias /></AppLayout>} />
              <Route path="/nr1/clima" element={<AppLayout><NR1Clima /></AppLayout>} />
              <Route path="/nr1/riscos" element={<AppLayout><NR1Riscos /></AppLayout>} />
              <Route path="/nr1/treinamentos" element={<AppLayout><NR1Treinamentos /></AppLayout>} />
              <Route path="/nr1/acoes" element={<AppLayout><NR1Acoes /></AppLayout>} />
              <Route path="/nr1/lideranca" element={<AppLayout><NR1Lideranca /></AppLayout>} />
              <Route path="/nr1/lideranca/responder/:token" element={<NR1LiderancaResponder />} />

              {/* Públicas (sem login) */}
              <Route path="/clima/:token" element={<ClimaResponderPublic />} />
              <Route path="/denuncia" element={<DenunciaPublica />} />
              <Route path="/privacidade" element={<Privacidade />} />
              <Route path="/lideranca/:token" element={<NR1LiderancaResponder />} />
              <Route path="/admissao/:codigo" element={<AdmissaoPublica />} />
              <Route path="/validar-holerite/:protocolo" element={<ValidarHolerite />} />
              <Route path="/meus-holerites" element={<MeusHolerites />} />
              <Route path="/nr1/relatorios" element={<AppLayout><NR1Relatorios /></AppLayout>} />
              <Route path="/nr1/config" element={<AppLayout><NR1Config /></AppLayout>} />
              <Route path="/nr1/auditoria" element={<AppLayout><NR1AuditoriaMT /></AppLayout>} />


              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;

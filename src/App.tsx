import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import EmployeeDetails from "./pages/EmployeeDetails";
import Stock from "./pages/Stock";
import Afastamentos from "./pages/Afastamentos";
import DistribuirEpi from "./pages/DistribuirEpi";
import DistribuirUniforme from "./pages/DistribuirUniforme";
import Sectors from "./pages/Sectors";
import Turnover from "./pages/Turnover";
import Financeiro from "./pages/Financeiro";
import Companies from "./pages/Companies";
import Payroll from "./pages/Payroll";
import Funcoes from "./pages/Funcoes";
import Contracts from "./pages/Contracts";
import Managers from "./pages/Managers";
import AdminUsers from "./pages/AdminUsers";
import SalaryAdjustment from "./pages/SalaryAdjustment";
import ControlePonto from "./pages/ControlePonto";
import NotFound from "./pages/NotFound";
import Vagas from "./pages/Vagas";
import VagaDetalhes from "./pages/VagaDetalhes";
import Recrutamento from "./pages/Recrutamento";
import CandidaturasVaga from "./pages/CandidaturasVaga";
import Relatorios from "./pages/Relatorios";
import SaudeOcupacional from "./pages/SaudeOcupacional";
import VacationSchedule from "./pages/VacationSchedule";
import Settings from "./pages/Settings";
import Avaliacoes from "./pages/Avaliacoes";
import Treinamentos from "./pages/Treinamentos";
import Adiantamentos from "./pages/Adiantamentos";
import PlanoAdmissaoDesligamento from "./pages/PlanoAdmissaoDesligamento";
import PeopleManager from "./pages/PeopleManager";
import Tacs from "./pages/Tacs";
import Crachas from "./pages/Crachas";
import Eventos from "./pages/Eventos";
import AIInsights from "./pages/AIInsights";
import ConsultaJudicial from "./pages/ConsultaJudicial";
import Contabilidade from "./pages/Contabilidade";
import NR1Dashboard from "./pages/nr1/Dashboard";
import NR1PainelGerencial from "./pages/nr1/PainelGerencial";
import NR1AuditoriaMT from "./pages/nr1/AuditoriaMT";
import NR1Denuncias from "./pages/nr1/Denuncias";
import NR1Clima from "./pages/nr1/Clima";
import NR1Riscos from "./pages/nr1/Riscos";
import NR1Treinamentos from "./pages/nr1/Treinamentos";
import NR1Acoes from "./pages/nr1/Acoes";
import NR1Lideranca from "./pages/nr1/Lideranca";
import NR1LiderancaResponder from "./pages/nr1/LiderancaResponder";
import NR1Relatorios from "./pages/nr1/Relatorios";
import NR1Config from "./pages/nr1/Config";
import ClimaResponderPublic from "./pages/public/ClimaResponder";
import DenunciaPublica from "./pages/public/DenunciaPublica";
import Privacidade from "./pages/public/Privacidade";
import MeusHolerites from "./pages/MeusHolerites";
import ValidarHolerite from "./pages/ValidarHolerite";
import AppLayout from "./components/layout/AppLayout";
import { FloatingAIChat } from "./components/ai/FloatingAIChat";

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
              <Route path="/validar-holerite/:protocolo" element={<ValidarHolerite />} />
              <Route path="/meus-holerites" element={<MeusHolerites />} />
              <Route path="/nr1/relatorios" element={<AppLayout><NR1Relatorios /></AppLayout>} />
              <Route path="/nr1/config" element={<AppLayout><NR1Config /></AppLayout>} />
              <Route path="/nr1/auditoria" element={<AppLayout><NR1AuditoriaMT /></AppLayout>} />


              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;

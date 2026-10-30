import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import {
  LayoutDashboard, Users, Shield, Briefcase, UsersRound, Clock, Calendar,
  Award, GraduationCap, ClipboardList, CalendarDays, Search as SearchIcon,
  UserPlus, Receipt, TrendingUp, DollarSign, Wallet, FileSignature,
  FileWarning, IdCard, Package, Activity, Building2, BarChart3, Settings,
  Bot, Scale, Calculator,
} from "lucide-react";

const allMenuItems = [
  { title: "Visão Geral", url: "/dashboard", icon: LayoutDashboard, keywords: "dashboard inicio home" },
  { title: "Funcionários", url: "/dashboard#funcionarios", icon: Users, keywords: "empregados colaboradores pessoas" },
  { title: "Gestores", url: "/managers", icon: Shield, keywords: "administradores gerentes" },
  { title: "Funções", url: "/funcoes", icon: Briefcase, keywords: "cargos posições" },
  { title: "People Manager", url: "/people-manager", icon: UsersRound, keywords: "gestão pessoas organograma" },
  { title: "Controle de Ponto", url: "/controle-ponto", icon: Clock, keywords: "frequência horário registro" },
  { title: "Escala de Férias", url: "/vacation-schedule", icon: Calendar, keywords: "vacação programação" },
  { title: "Avaliações", url: "/avaliacoes", icon: Award, keywords: "desempenho performance notas" },
  { title: "Treinamentos", url: "/treinamentos", icon: GraduationCap, keywords: "cursos capacitação aulas" },
  { title: "Checklists", url: "/plano-admissao-desligamento", icon: ClipboardList, keywords: "admissão desligamento plano" },
  { title: "Admissão digital", url: "/admissao-digital", icon: UserPlus, keywords: "admissão link novo colaborador contratação documentos" },
  { title: "Eventos", url: "/eventos", icon: CalendarDays, keywords: "agenda reuniões compromissos" },
  { title: "Vagas", url: "/vagas", icon: SearchIcon, keywords: "recrutamento oportunidades emprego" },
  { title: "Candidaturas", url: "/recrutamento", icon: UserPlus, keywords: "candidatos seleção processo seletivo" },
  { title: "Folha de Pagamento", url: "/payroll", icon: Receipt, keywords: "holerite salário pagamento folha" },
  { title: "Reajuste Salarial", url: "/salary-adjustment", icon: TrendingUp, keywords: "aumento salário correção" },
  { title: "Adiantamentos", url: "/adiantamentos", icon: DollarSign, keywords: "antecipação vale adiantamento" },
  { title: "Financeiro", url: "/financeiro", icon: Wallet, keywords: "custos gastos finanças" },
  { title: "Contratos", url: "/contracts", icon: FileSignature, keywords: "documentos acordo" },
  { title: "TACs", url: "/tacs", icon: FileWarning, keywords: "termos advertência comunicado" },
  { title: "Crachás", url: "/crachas", icon: IdCard, keywords: "identidade cartão" },
  { title: "Consulta Judicial", url: "/consulta-judicial", icon: Scale, keywords: "processos judicial cpf" },
  { title: "EPIs / Uniformes", url: "/stock", icon: Package, keywords: "estoque equipamento proteção" },
  { title: "Saúde Ocupacional", url: "/saude-ocupacional", icon: Activity, keywords: "exames médicos encaminhamento" },
  { title: "Empresas", url: "/companies", icon: Building2, keywords: "empresa cadastro" },
  { title: "Setores", url: "/sectors", icon: Building2, keywords: "departamento setor" },
  { title: "Turnover", url: "/turnover", icon: TrendingUp, keywords: "rotatividade demissão" },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3, keywords: "reports exportar" },
  { title: "Configurações", url: "/settings", icon: Settings, keywords: "config preferências sistema" },
  { title: "Inteligência Artificial", url: "/ai-insights", icon: Bot, keywords: "ia cerebrum ai chat" },
  { title: "Info. Contabilidade", url: "/contabilidade", icon: Calculator, keywords: "contabilidade contador informações mensal" },
];

export default function NavigationSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return allMenuItems.filter((item) => {
      const text = `${item.title} ${item.keywords}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return text.includes(q);
    });
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (url: string) => {
    navigate(url);
    setQuery("");
    setFocused(false);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar módulo... (ex: adiantamento, férias)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          className="h-10 rounded-full border-0 bg-muted pl-10 pr-9 focus-visible:ring-1"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {focused && query.trim() && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-popover border rounded-xl shadow-lg max-h-[300px] overflow-y-auto">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 text-center">Nenhum resultado encontrado.</p>
          ) : (
            results.map((item) => (
              <button
                key={item.url + item.title}
                onClick={() => handleSelect(item.url)}
                className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-accent transition-colors"
              >
                <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm">{item.title}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

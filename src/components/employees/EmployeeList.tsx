import { useEffect, useState } from "react";
import { parseDateOnly, todayISO} from "@/lib/date";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Filter, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EmployeeListProps {
  searchQuery: string;
  onStatsUpdate: () => void;
  empresaId?: string;
}

const EmployeeList = ({ searchQuery, onStatsUpdate, empresaId }: EmployeeListProps) => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<any[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [empresaFilter, setEmpresaFilter] = useState<string>("all");
  const [setorFilter, setSetorFilter] = useState<string>("all");
  const [contratoFilter, setContratoFilter] = useState<string>("all");
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [setores, setSetores] = useState<any[]>([]);
  const [employeesOnVacationIds, setEmployeesOnVacationIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchEmployees();
    fetchEmpresas();
    fetchSetores();
    fetchVacationStatus();
  }, [empresaId]);

  useEffect(() => {
    filterEmployees();
  }, [searchQuery, statusFilter, empresaFilter, setorFilter, contratoFilter, employees]);

  const fetchEmployees = async () => {
    try {
      let query = supabase
        .from("employees")
        .select("*")
        .order("nome_completo");

      if (empresaId && empresaId !== "all") {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmpresas = async () => {
    try {
      const { data, error } = await supabase.from("empresas").select("*").order("nome");
      if (error) throw error;
      setEmpresas(data || []);
    } catch (error) {
      console.error("Error fetching empresas:", error);
    }
  };

  const fetchSetores = async () => {
    try {
      const { data, error } = await supabase.from("setores").select("*").order("nome");
      if (error) throw error;
      setSetores(data || []);
    } catch (error) {
      console.error("Error fetching setores:", error);
    }
  };

  const fetchVacationStatus = async () => {
    try {
      const todayStr = todayISO();
      const { data, error } = await supabase
        .from("ferias")
        .select("employee_id")
        .lte("periodo_gozo_inicio", todayStr)
        .gte("periodo_gozo_fim", todayStr);
      if (error) throw error;
      setEmployeesOnVacationIds(new Set(data?.map(f => f.employee_id) || []));
    } catch (error) {
      console.error("Error fetching vacation status:", error);
    }
  };

  const getEffectiveStatus = (emp: any) => {
    if (employeesOnVacationIds.has(emp.id)) return "ferias";
    if (emp.status === "ferias") return "ativo"; // Não está em férias hoje, mostrar como ativo
    return emp.status;
  };

  const filterEmployees = () => {
    let filtered = employees;

    if (statusFilter !== "all") {
      filtered = filtered.filter((emp) => getEffectiveStatus(emp) === statusFilter);
    }
    if (empresaFilter !== "all") {
      filtered = filtered.filter((emp) => emp.empresa_id === empresaFilter);
    }
    if (setorFilter !== "all") {
      filtered = filtered.filter((emp) => emp.setor === setorFilter);
    }
    if (contratoFilter !== "all") {
      filtered = filtered.filter((emp) => emp.tipo_contrato === contratoFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (emp) =>
          emp.nome_completo.toLowerCase().includes(query) ||
          emp.cargo.toLowerCase().includes(query) ||
          (emp.setor && emp.setor.toLowerCase().includes(query))
      );
    }

    setFilteredEmployees(filtered);
  };


  const getContratoLabel = (tipo: string | null) => {
    const labels: Record<string, string> = {
      fixo: "Fixo",
      intermitente: "Intermitente",
      prestador_servico: "Prestador",
    };
    return tipo ? labels[tipo] || tipo : "—";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const FAIXA: Record<string, string> = {
    ativo: "border-l-primary",
    ferias: "border-l-sky-400",
    afastado: "border-l-rose-400",
    em_admissao: "border-l-amber-400",
    demitido: "border-l-slate-300",
  };
  const ETIQUETA: Record<string, { texto: string; cor: string } | undefined> = {
    ferias: { texto: "Férias", cor: "bg-sky-50 text-sky-700" },
    afastado: { texto: "Afastado", cor: "bg-rose-50 text-rose-700" },
    em_admissao: { texto: "Em admissão", cor: "bg-amber-50 text-amber-800" },
    demitido: { texto: "Desligado", cor: "bg-slate-100 text-slate-600" },
  };
  const filtroCls = "h-9 w-auto min-w-[150px] gap-2 rounded-full border-border bg-card text-xs font-medium text-muted-foreground";
  const colunas = "grid grid-cols-[minmax(0,1fr)_40px] md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_40px] lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_40px]";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filtrar
        </span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={filtroCls} aria-label="Situação"><SelectValue placeholder="Situação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            <SelectItem value="em_admissao">Em admissão</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="ferias">Férias</SelectItem>
            <SelectItem value="afastado">Afastado</SelectItem>
            <SelectItem value="demitido">Desligado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
          <SelectTrigger className={filtroCls} aria-label="Empresa"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {empresas.map((empresa) => <SelectItem key={empresa.id} value={empresa.id}>{empresa.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={setorFilter} onValueChange={setSetorFilter}>
          <SelectTrigger className={filtroCls} aria-label="Setor"><SelectValue placeholder="Setor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {setores.map((setor) => <SelectItem key={setor.id} value={setor.nome}>{setor.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={contratoFilter} onValueChange={setContratoFilter}>
          <SelectTrigger className={filtroCls} aria-label="Contrato"><SelectValue placeholder="Contrato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os contratos</SelectItem>
            <SelectItem value="fixo">Fixo</SelectItem>
            <SelectItem value="intermitente">Intermitente</SelectItem>
            <SelectItem value="prestador_servico">Prestador de serviço</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {filteredEmployees.length} colaborador{filteredEmployees.length !== 1 ? "es" : ""}
        </span>
      </div>

      {filteredEmployees.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Nenhum colaborador encontrado</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <div className={`${colunas} gap-4 px-4 pl-5 pt-2 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground`}>
            <div>Colaborador</div>
            <div className="hidden md:block">Setor</div>
            <div className="hidden lg:block">Admissão</div>
            <div className="hidden lg:block">Contrato</div>
            <div className="hidden lg:block">Código</div>
            <div />
          </div>
          {filteredEmployees.map((employee) => {
            const st = getEffectiveStatus(employee);
            const etiqueta = ETIQUETA[st];
            return (
              <div
                key={employee.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/employee/${employee.id}`)}
                onKeyDown={(e) => { if (e.key === "Enter") navigate(`/employee/${employee.id}`); }}
                className={`${colunas} min-h-[60px] cursor-pointer items-center gap-4 rounded-lg border-l-4 ${FAIXA[st] || "border-l-slate-200"} bg-card px-4 py-2 shadow-[0_1px_2px_rgba(20,24,40,0.06)] transition hover:shadow-[0_2px_8px_rgba(20,24,40,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative shrink-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={employee.foto_url || undefined} className="object-cover" />
                      <AvatarFallback className="bg-muted text-xs font-bold text-muted-foreground">{getInitials(employee.nome_completo)}</AvatarFallback>
                    </Avatar>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${st === "ativo" ? "bg-emerald-500" : "bg-slate-300"}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{employee.nome_completo}</p>
                    <p className="truncate text-xs text-muted-foreground">{employee.cargo}</p>
                  </div>
                  {etiqueta && (
                    <span className={`ml-1 hidden shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] sm:inline ${etiqueta.cor}`}>{etiqueta.texto}</span>
                  )}
                </div>
                <div className="hidden truncate text-sm text-muted-foreground md:block">{employee.setor || "—"}</div>
                <div className="hidden text-sm text-muted-foreground lg:block">
                  {employee.data_admissao ? (parseDateOnly(employee.data_admissao) ?? new Date()).toLocaleDateString("pt-BR") : "—"}
                </div>
                <div className="hidden text-sm text-muted-foreground lg:block">{getContratoLabel(employee.tipo_contrato)}</div>
                <div className="hidden text-sm text-muted-foreground lg:block">{employee.codigo_funcionario || "—"}</div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  aria-label={`Abrir ficha de ${employee.nome_completo}`}
                  onClick={(e) => { e.stopPropagation(); navigate(`/employee/${employee.id}`); }}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmployeeList;

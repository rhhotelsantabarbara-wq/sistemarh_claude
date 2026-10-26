import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Calendar, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import VariaveisConfig from "@/components/payroll/VariaveisConfig";
import LancamentoFolhaForm from "@/components/payroll/LancamentoFolhaForm";
import RelatorioDetalhadoDialog from "@/components/payroll/RelatorioDetalhadoDialog";
import HoleriteDialog from "@/components/payroll/HoleriteDialog";
import { AuditoriaHoleritesTab } from "@/components/payroll/AuditoriaHoleritesTab";
import { ImportarHoleritesTab } from "@/components/payroll/ImportarHoleritesTab";
import { HoleriteDiferencaLoteTab } from "@/components/payroll/HoleriteDiferencaLoteTab";
import jsPDF from "jspdf";

const TIPO_FOLHA_OPTIONS = [
  { value: "salario", label: "Folha de Salário" },
  { value: "complementar", label: "Folha Complementar" },
  { value: "adiantamento", label: "Folha de Adiantamento" },
  { value: "decimo_terceiro", label: "13º Salário" },
  { value: "rescisao", label: "Rescisão" },
];

interface Empresa {
  id: string;
  nome: string;
}

interface Setor {
  id: string;
  nome: string;
}

interface Employee {
  id: string;
  nome_completo: string;
  cargo: string;
  setor: string | null;
  salario: number | null;
  tipo_contrato: string;
}

interface Variavel {
  id: string;
  nome: string;
  codigo?: string | null;
  tipo: "desconto" | "provento";
}

interface PagamentoItem {
  id: string;
  variavel_id: string;
  valor: number;
  variaveis_folha: Variavel;
}

interface Pagamento {
  id: string;
  employee_id: string;
  empresa_id: string;
  valor_bruto: number;
  desconto: number;
  descontos: number;
  valor_liquido: number;
  observacoes: string | null;
  mes: number;
  ano: number;
  tipo_folha: string;
  status?: string;
  employees: {
    nome_completo: string;
    cargo: string;
    tipo_contrato: string;
    setor: string | null;
    cpf: string | null;
    data_admissao: string | null;
  };
  folha_pagamento_itens?: PagamentoItem[];
}

interface ResumoMensal {
  mes: number;
  ano: number;
  totalPagamentos: number;
  totalEmConta: number;
  totalEmMaos: number;
  totalDescontos: number;
  totalGeral: number;
}

interface ResumoVariavel {
  variavel: string;
  tipo: "desconto" | "provento";
  funcionarios: number;
  total: number;
}

const Payroll = () => {
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>("all");
  const [selectedSetor, setSelectedSetor] = useState<string>("all");
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [tipoContrato, setTipoContrato] = useState<string>("all");
  const [tipoFolha, setTipoFolha] = useState<string>("all");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [todosPagamentos, setTodosPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPagamento, setEditingPagamento] = useState<Pagamento | null>(null);
  const [showLancamentoForm, setShowLancamentoForm] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("lancamentos");
  const [showRelatorioDialog, setShowRelatorioDialog] = useState(false);
  const [holeriteDialogOpen, setHoleriteDialogOpen] = useState(false);
  const [selectedPagamentoForHolerite, setSelectedPagamentoForHolerite] = useState<Pagamento | null>(null);
  const [selectedEmployeeForLancamento, setSelectedEmployeeForLancamento] = useState<string>("all");
  const [selectedTipoFolhaLancamento, setSelectedTipoFolhaLancamento] = useState<string>("salario");
  const [employeesDemitidos, setEmployeesDemitidos] = useState<Employee[]>([]);

  useEffect(() => {
    fetchEmpresas();
    fetchSetores();
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchPagamentos();
    fetchTodosPagamentos();
    fetchEmployeesDemitidos();
  }, [selectedEmpresa, mes, ano, tipoContrato, selectedSetor, tipoFolha]);

  const fetchEmpresas = async () => {
    const { data, error } = await supabase
      .from("empresas")
      .select("id, nome")
      .order("nome");

    if (error) {
      toast.error("Erro ao carregar empresas");
      return;
    }
    setEmpresas(data || []);
  };

  const fetchSetores = async () => {
    const { data, error } = await supabase
      .from("setores")
      .select("id, nome")
      .order("nome");

    if (error) {
      console.error("Erro ao carregar setores:", error);
      return;
    }
    setSetores(data || []);
  };

  const fetchEmployees = async () => {
    try {
      let query = supabase
        .from("employees")
        .select("id, nome_completo, cargo, setor, salario, tipo_contrato")
        .in("status", ["ativo", "ferias"]);

      if (selectedEmpresa && selectedEmpresa !== "all") {
        query = query.eq("empresa_id", selectedEmpresa);
      }

      if (tipoContrato && tipoContrato !== "all") {
        query = query.eq("tipo_contrato", tipoContrato as any);
      }

      if (selectedSetor && selectedSetor !== "all") {
        const setorNome = setores.find(s => s.id === selectedSetor)?.nome;
        if (setorNome) {
          query = query.eq("setor", setorNome);
        }
      }

      const { data, error } = await query.order("nome_completo");

      if (error) {
        console.error("Erro ao carregar funcionários:", error);
        setEmployees([]);
        return;
      }
      setEmployees(data || []);
    } catch (err) {
      console.error("Erro inesperado ao carregar funcionários:", err);
      setEmployees([]);
    }
  };

  const fetchEmployeesDemitidos = async () => {
    try {
      let query = supabase
        .from("employees")
        .select("id, nome_completo, cargo, setor, salario, tipo_contrato")
        .eq("status", "demitido" as any);

      if (selectedEmpresa && selectedEmpresa !== "all") {
        query = query.eq("empresa_id", selectedEmpresa);
      }

      const { data, error } = await query.order("nome_completo");

      if (error) {
        console.error("Erro ao carregar funcionários demitidos:", error);
        setEmployeesDemitidos([]);
        return;
      }
      setEmployeesDemitidos(data || []);
    } catch (err) {
      console.error("Erro inesperado:", err);
      setEmployeesDemitidos([]);
    }
  };

  const fetchPagamentos = async () => {
    let query = supabase
      .from("folha_pagamento")
      .select(`
        id,
        employee_id,
        empresa_id,
        valor_bruto,
        desconto,
        descontos,
        valor_liquido,
        observacoes,
        mes,
        ano,
        tipo_folha,
        status,
        employees (
          nome_completo,
          cargo,
          tipo_contrato,
          setor,
          cpf,
          data_admissao
        ),
        folha_pagamento_itens (
          id,
          variavel_id,
          valor,
          variaveis_folha (
            id,
            nome,
            codigo,
            tipo
          )
        )
      `)
      .eq("mes", mes)
      .eq("ano", ano);

    if (selectedEmpresa && selectedEmpresa !== "all") {
      query = query.eq("empresa_id", selectedEmpresa);
    }
    
    if (tipoFolha && tipoFolha !== "all") {
      query = query.eq("tipo_folha", tipoFolha);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao carregar pagamentos:", error);
      return;
    }
    
    let filteredData = data || [];
    
    if (tipoContrato && tipoContrato !== "all") {
      filteredData = filteredData.filter((p: any) => p.employees?.tipo_contrato === tipoContrato);
    }
    
    if (selectedSetor && selectedSetor !== "all") {
      const setorNome = setores.find(s => s.id === selectedSetor)?.nome;
      if (setorNome) {
        filteredData = filteredData.filter((p: any) => p.employees?.setor === setorNome);
      }
    }
    
    // Ordenar alfabeticamente pelo nome do funcionário
    filteredData.sort((a: any, b: any) => {
      const nomeA = a.employees?.nome_completo?.toLowerCase() || '';
      const nomeB = b.employees?.nome_completo?.toLowerCase() || '';
      return nomeA.localeCompare(nomeB, 'pt-BR');
    });
    
    setPagamentos(filteredData as any);
  };

  const fetchTodosPagamentos = async () => {
    let query = supabase
      .from("folha_pagamento")
      .select(`
        id,
        employee_id,
        empresa_id,
        valor_bruto,
        desconto,
        descontos,
        valor_liquido,
        observacoes,
        mes,
        ano,
        tipo_folha,
        status,
        employees (
          nome_completo,
          cargo,
          tipo_contrato,
          setor,
          cpf,
          data_admissao
        ),
        folha_pagamento_itens (
          id,
          variavel_id,
          valor,
          variaveis_folha (
            id,
            nome,
            codigo,
            tipo
          )
        )
      `)
      .order("ano", { ascending: false })
      .order("mes", { ascending: false });

    if (selectedEmpresa && selectedEmpresa !== "all") {
      query = query.eq("empresa_id", selectedEmpresa);
    }
    
    if (tipoFolha && tipoFolha !== "all") {
      query = query.eq("tipo_folha", tipoFolha);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao carregar histórico de pagamentos:", error);
      return;
    }
    
    let filteredData = data || [];
    
    if (tipoContrato && tipoContrato !== "all") {
      filteredData = filteredData.filter((p: any) => p.employees?.tipo_contrato === tipoContrato);
    }
    
    if (selectedSetor && selectedSetor !== "all") {
      const setorNome = setores.find(s => s.id === selectedSetor)?.nome;
      if (setorNome) {
        filteredData = filteredData.filter((p: any) => p.employees?.setor === setorNome);
      }
    }
    
    // Ordenar alfabeticamente pelo nome do funcionário
    filteredData.sort((a: any, b: any) => {
      const nomeA = a.employees?.nome_completo?.toLowerCase() || '';
      const nomeB = b.employees?.nome_completo?.toLowerCase() || '';
      return nomeA.localeCompare(nomeB, 'pt-BR');
    });
    
    setTodosPagamentos(filteredData as any);
  };

  // Helper para calcular valor em conta de um pagamento
  const calcularValorEmConta = (pag: Pagamento) => {
    const itens = pag.folha_pagamento_itens || [];
    const itemEmConta = itens.find(i => 
      i.variaveis_folha?.nome?.toLowerCase().includes("valor em conta") ||
      (i.variaveis_folha as any)?.codigo === "3503"
    );
    return itemEmConta?.valor || 0;
  };

  const calcularTotalDescontos = (pag: Pagamento) => {
    const somaItens = (pag.folha_pagamento_itens || [])
      .filter((i) => i.variaveis_folha?.tipo === "desconto")
      .reduce((sum, i) => sum + Number(i.valor || 0), 0);
    const registrado = Number(pag.desconto || 0) + Number(pag.descontos || 0);
    return Math.max(somaItens, registrado);
  };

  const getResumosMensais = (): ResumoMensal[] => {
    const resumos: Record<string, ResumoMensal> = {};
    
    todosPagamentos.forEach(pag => {
      const key = `${pag.ano}-${pag.mes}`;
      if (!resumos[key]) {
        resumos[key] = {
          mes: pag.mes,
          ano: pag.ano,
          totalPagamentos: 0,
          totalEmConta: 0,
          totalEmMaos: 0,
          totalDescontos: 0,
          totalGeral: 0,
        };
      }
      const valorEmConta = calcularValorEmConta(pag);
      resumos[key].totalPagamentos += 1;
      resumos[key].totalEmConta += valorEmConta;
      resumos[key].totalEmMaos += pag.valor_liquido; // Valor em Conta = Proventos - Descontos (valor líquido)
      resumos[key].totalDescontos += calcularTotalDescontos(pag);
      resumos[key].totalGeral += pag.valor_bruto;
    });
    
    return Object.values(resumos).sort((a, b) => {
      if (a.ano !== b.ano) return b.ano - a.ano;
      return b.mes - a.mes;
    });
  };

  const getResumoVariaveis = (): ResumoVariavel[] => {
    const resumos: Record<string, ResumoVariavel> = {};
    
    pagamentos.forEach(pag => {
      let somaDescontosItens = 0;
      if (pag.folha_pagamento_itens) {
        pag.folha_pagamento_itens.forEach(item => {
          const varName = item.variaveis_folha?.nome || "Desconhecido";
          const varTipo = item.variaveis_folha?.tipo || "desconto";
          if (varTipo === "desconto") somaDescontosItens += Number(item.valor || 0);
          
          if (!resumos[varName]) {
            resumos[varName] = {
              variavel: varName,
              tipo: varTipo,
              funcionarios: 0,
              total: 0,
            };
          }
          resumos[varName].funcionarios += 1;
          resumos[varName].total += item.valor;
        });
      }

      const descontoSemRubrica = Math.max(0, calcularTotalDescontos(pag) - somaDescontosItens);
      if (descontoSemRubrica > 0.009) {
        if (!resumos["Outros descontos"]) {
          resumos["Outros descontos"] = {
            variavel: "Outros descontos",
            tipo: "desconto",
            funcionarios: 0,
            total: 0,
          };
        }
        resumos["Outros descontos"].funcionarios += 1;
        resumos["Outros descontos"].total += descontoSemRubrica;
      }
    });
    
    return Object.values(resumos).sort((a, b) => b.total - a.total);
  };

  const getPagamentosByMonth = (mes: number, ano: number) => {
    return todosPagamentos.filter(p => p.mes === mes && p.ano === ano);
  };

  const handleOpenLancamentoForm = () => {
    if (!selectedEmpresa || selectedEmpresa === "all") {
      toast.error("Selecione uma empresa específica para lançar pagamentos");
      return;
    }
    const isRescisao = selectedTipoFolhaLancamento === "rescisao";
    const targetEmployees = isRescisao ? employeesDemitidos : employees;
    if (targetEmployees.length === 0) {
      toast.error(isRescisao 
        ? "Não há funcionários demitidos nesta empresa" 
        : "Não há funcionários ativos nesta empresa");
      return;
    }
    setShowLancamentoForm(true);
  };

  const handleLancamentoSuccess = async (lancamentoMes?: number, lancamentoAno?: number) => {
    setShowLancamentoForm(false);
    
    // Atualiza os filtros para mostrar o mês lançado
    if (lancamentoMes !== undefined && lancamentoAno !== undefined) {
      setMes(lancamentoMes);
      setAno(lancamentoAno);
    }
    
    // Recarrega os dados imediatamente
    await Promise.all([fetchPagamentos(), fetchTodosPagamentos()]);
  };

  const handleImportComplete = async (holerites: Array<{ mes: number | null; ano: number | null; tipo_folha?: string; empresa_id?: string | null }>) => {
    const comPeriodo = holerites.filter((h) => h.mes && h.ano);
    const primeiro = comPeriodo[0];
    const mesmoPeriodo = !!primeiro && comPeriodo.every((h) => h.mes === primeiro.mes && h.ano === primeiro.ano);
    const mesmoTipo = !!primeiro?.tipo_folha && comPeriodo.every((h) => h.tipo_folha === primeiro.tipo_folha);
    const mesmaEmpresa = !!primeiro?.empresa_id && comPeriodo.every((h) => h.empresa_id === primeiro.empresa_id);

    if (mesmoPeriodo) {
      setMes(primeiro.mes as number);
      setAno(primeiro.ano as number);
      if (mesmaEmpresa && selectedEmpresa !== "all" && selectedEmpresa !== primeiro.empresa_id) {
        setSelectedEmpresa(primeiro.empresa_id as string);
      }
      if (mesmoTipo && tipoFolha !== "all" && tipoFolha !== primeiro.tipo_folha) {
        setTipoFolha(primeiro.tipo_folha as string);
      }
      if (primeiro.mes === mes && primeiro.ano === ano) {
        await Promise.all([fetchPagamentos(), fetchTodosPagamentos()]);
      }
    } else {
      await Promise.all([fetchPagamentos(), fetchTodosPagamentos()]);
    }
    setActiveTab("lancamentos");
  };

  const handleUpdatePagamento = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPagamento) return;

    const formData = new FormData(e.currentTarget);
    const valor_bruto = parseFloat(formData.get("valor_bruto") as string);
    const desconto = parseFloat(formData.get("desconto") as string) || 0;
    const descontos = parseFloat(formData.get("descontos") as string) || 0;
    const valor_liquido = valor_bruto - desconto - descontos;

    try {
      const { error } = await supabase
        .from("folha_pagamento")
        .update({
          valor_bruto,
          desconto,
          descontos,
          valor_liquido,
          observacoes: formData.get("observacoes") as string,
        })
        .eq("id", editingPagamento.id);

      if (error) throw error;

      toast.success("Pagamento atualizado!");
      setEditingPagamento(null);
      fetchPagamentos();
      fetchTodosPagamentos();
    } catch (error) {
      console.error("Erro ao atualizar pagamento:", error);
      toast.error("Erro ao atualizar pagamento");
    }
  };

  const handleDeletePagamento = async (id: string) => {
    try {
      const { error } = await supabase
        .from("folha_pagamento")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Pagamento excluído!");
      fetchPagamentos();
      fetchTodosPagamentos();
    } catch (error: any) {
      console.error("Erro ao excluir pagamento:", error);
      toast.error(`Erro ao excluir pagamento: ${error?.message || "desconhecido"}`);
    }
  };

  const handleDeleteTodosDoMes = async () => {
    const ids = pagamentos.map((p) => p.id);
    if (ids.length === 0) {
      toast.info("Nenhum holerite para excluir no filtro atual.");
      return;
    }
    try {
      const { error } = await supabase
        .from("folha_pagamento")
        .delete()
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} holerite(s) excluído(s)!`);
      fetchPagamentos();
      fetchTodosPagamentos();
    } catch (error: any) {
      console.error("Erro ao excluir holerites do mês:", error);
      toast.error(`Erro ao excluir: ${error?.message || "desconhecido"}`);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    const empresaNome = empresas.find(e => e.id === selectedEmpresa)?.nome || "";
    const mesNome = new Date(ano, mes - 1).toLocaleString("pt-BR", { month: "long" });
    
    doc.setFontSize(18);
    doc.text("FOLHA DE PAGAMENTO", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.text(`Empresa: ${empresaNome}`, pageWidth / 2, 30, { align: "center" });
    doc.text(`Período: ${mesNome}/${ano}`, pageWidth / 2, 36, { align: "center" });
    
    let yPosition = 50;
    doc.setFontSize(10);
    
    // Para cada funcionário
    pagamentos.forEach((pag) => {
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }
      
      const tipoContratoLabel = pag.employees.tipo_contrato === 'fixo' ? 'Fixo' : 
                                pag.employees.tipo_contrato === 'intermitente' ? 'Intermitente' : 
                                'Prestador de Serviço';
      
      doc.setFontSize(11);
      doc.text(`FUNCIONÁRIO: ${pag.employees.nome_completo}`, 20, yPosition);
      doc.setFontSize(9);
      doc.text(`Cargo: ${pag.employees.cargo} | Tipo: ${tipoContratoLabel}`, 20, yPosition + 5);
      yPosition += 12;
      
      // Salário base
      doc.text(`  Salário Base: R$ ${pag.valor_bruto.toFixed(2)}`, 20, yPosition);
      yPosition += 6;
      
      // Itens (proventos e descontos)
      if (pag.folha_pagamento_itens && pag.folha_pagamento_itens.length > 0) {
        const proventos = pag.folha_pagamento_itens.filter(i => i.variaveis_folha?.tipo === 'provento');
        const descontos = pag.folha_pagamento_itens.filter(i => i.variaveis_folha?.tipo === 'desconto');
        
        if (proventos.length > 0) {
          doc.text("  PROVENTOS:", 20, yPosition);
          yPosition += 5;
          proventos.forEach(item => {
            doc.text(`    ${item.variaveis_folha?.nome}: R$ ${item.valor.toFixed(2)}`, 25, yPosition);
            yPosition += 5;
          });
        }
        
        if (descontos.length > 0) {
          doc.text("  DESCONTOS:", 20, yPosition);
          yPosition += 5;
          descontos.forEach(item => {
            doc.text(`    ${item.variaveis_folha?.nome}: R$ ${item.valor.toFixed(2)}`, 25, yPosition);
            yPosition += 5;
          });
        }
      }
      
      doc.setFontSize(10);
      doc.text(`  VALOR EM CONTA: R$ ${pag.valor_liquido.toFixed(2)}`, 20, yPosition);
      yPosition += 10;
      
      if (pag.observacoes) {
        doc.setFontSize(8);
        doc.text(`  Obs: ${pag.observacoes}`, 20, yPosition);
        yPosition += 8;
      }
    });
    
    // Resumo por variável
    const resumoVariaveis = getResumoVariaveis();
    if (resumoVariaveis.length > 0) {
      if (yPosition > 200) {
        doc.addPage();
        yPosition = 20;
      }
      
      yPosition += 10;
      doc.setFontSize(12);
      doc.text("RESUMO POR VARIÁVEL", 20, yPosition);
      yPosition += 8;
      
      doc.setFontSize(9);
      resumoVariaveis.forEach(rv => {
        const tipoLabel = rv.tipo === 'provento' ? '(+)' : '(-)';
        doc.text(`${rv.variavel} ${tipoLabel}: ${rv.funcionarios} func. | R$ ${rv.total.toFixed(2)}`, 25, yPosition);
        yPosition += 5;
      });
    }
    
    // Totais gerais
    if (yPosition > 230) {
      doc.addPage();
      yPosition = 20;
    }
    
    const totalProventos = pagamentos.reduce((sum, p) => sum + p.valor_bruto, 0);
    const totalDescontos = pagamentos.reduce((sum, p) => sum + p.desconto, 0);
    const totalLiquido = pagamentos.reduce((sum, p) => sum + p.valor_liquido, 0);
    
    yPosition += 10;
    doc.setFontSize(12);
    doc.text("TOTAIS GERAIS", 20, yPosition);
    yPosition += 8;
    doc.setFontSize(10);
    doc.text(`Total Bruto: R$ ${totalProventos.toFixed(2)}`, 25, yPosition);
    doc.text(`Total Descontos: R$ ${totalDescontos.toFixed(2)}`, 25, yPosition + 6);
    doc.text(`Total em Conta: R$ ${totalLiquido.toFixed(2)}`, 25, yPosition + 12);
    
    doc.save(`folha-pagamento-${mesNome}-${ano}.pdf`);
  };

  const valorTotal = pagamentos.reduce((sum, p) => sum + p.valor_liquido, 0);
  const resumosMensais = getResumosMensais();
  const resumoVariaveis = getResumoVariaveis();

  const handleOpenHolerite = (pag: Pagamento) => {
    setSelectedPagamentoForHolerite(pag);
    setHoleriteDialogOpen(true);
  };

  const getTipoFolhaLabel = (tipo: string) => {
    const option = TIPO_FOLHA_OPTIONS.find(o => o.value === tipo);
    return option?.label || tipo;
  };

  const renderPagamentoCard = (pag: Pagamento, showActions: boolean = true) => {
    const proventos = pag.folha_pagamento_itens?.filter(i => i.variaveis_folha?.tipo === 'provento') || [];
    const descontos = pag.folha_pagamento_itens?.filter(i => i.variaveis_folha?.tipo === 'desconto') || [];
    const totalDescontos = calcularTotalDescontos(pag);
    const descontosMapeados = descontos.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const descontoSemRubrica = Math.max(0, totalDescontos - descontosMapeados);
    
    return (
      <div key={pag.id} className="flex items-start justify-between p-4 border rounded-lg">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold">{pag.employees.nome_completo}</p>
            <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
              {getTipoFolhaLabel(pag.tipo_folha || "salario")}
            </span>
            {pag.status === "rascunho" && (
              <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 font-medium">
                Rascunho — Importado
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{pag.employees.cargo}</p>
          <p className="text-xs text-muted-foreground">
            {pag.employees.tipo_contrato === 'fixo' ? 'Fixo' : 
             pag.employees.tipo_contrato === 'intermitente' ? 'Intermitente' : 
             'Prestador de Serviço'}
          </p>
          <div className="mt-2 grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium text-green-600">Proventos</p>
              <p>Salário: R$ {pag.valor_bruto.toFixed(2)}</p>
              {proventos.map(item => (
                <p key={item.id}>{item.variaveis_folha?.nome}: R$ {item.valor.toFixed(2)}</p>
              ))}
            </div>
            <div>
              <p className="font-medium text-red-600">Descontos</p>
              {descontos.length > 0 || descontoSemRubrica > 0.009 ? (
                <>
                  {descontos.map(item => (
                    <p key={item.id}>{item.variaveis_folha?.nome}: R$ {item.valor.toFixed(2)}</p>
                  ))}
                  {descontoSemRubrica > 0.009 && (
                    <p>Outros descontos: R$ {descontoSemRubrica.toFixed(2)}</p>
                  )}
                </>
              ) : <p className="text-muted-foreground">-</p>}
            </div>
            <div>
              <p className="font-medium">Resumo</p>
              <p className="text-lg font-bold text-primary">Valor em Conta: R$ {pag.valor_liquido.toFixed(2)}</p>
            </div>
          </div>
          {pag.observacoes && <p className="text-muted-foreground mt-2 text-sm">{pag.observacoes}</p>}
        </div>
        {showActions && (
          <div className="flex gap-2 ml-4">
            {pag.status === "rascunho" && (
              <Button
                variant="default"
                size="sm"
                onClick={async () => {
                  const { error } = await supabase
                    .from("folha_pagamento")
                    .update({ status: "final" })
                    .eq("id", pag.id);
                  if (error) toast.error("Erro ao liberar");
                  else {
                    toast.success("Holerite liberado para o funcionário");
                    fetchPagamentos();
                    fetchTodosPagamentos();
                  }
                }}
                title="Liberar para o funcionário assinar"
              >
                Liberar
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => handleOpenHolerite(pag)} title="Imprimir Holerite">
              <Printer className="w-4 h-4" />
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setEditingPagamento(pag)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Pagamento</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUpdatePagamento} className="space-y-4">
                  <div>
                    <Label>Valor Bruto</Label>
                    <Input
                      name="valor_bruto"
                      type="number"
                      step="0.01"
                      defaultValue={pag.valor_bruto}
                      required
                    />
                  </div>
                  <div>
                    <Label>Desconto</Label>
                    <Input
                      name="desconto"
                      type="number"
                      step="0.01"
                      defaultValue={pag.desconto || 0}
                    />
                  </div>
                  <div>
                    <Label>Valor em conta</Label>
                    <Input
                      name="descontos"
                      type="number"
                      step="0.01"
                      defaultValue={pag.descontos || 0}
                    />
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Textarea
                      name="observacoes"
                      defaultValue={pag.observacoes || ""}
                      rows={3}
                    />
                  </div>
                  <Button type="submit">Salvar</Button>
                </form>
              </DialogContent>
            </Dialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deseja realmente excluir o pagamento de {pag.employees.nome_completo}? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDeletePagamento(pag.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background sm:p-2 lg:p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold">Folha de Pagamento</h1>
          </div>
          {activeTab === "lancamentos" && pagamentos.length > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowRelatorioDialog(true)}>
                <FileText className="w-4 h-4 mr-2" />
                Relatório Detalhado
              </Button>
              <Button onClick={exportToPDF}>
                <Download className="w-4 h-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          )}
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <Label>Empresa</Label>
                <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as empresas</SelectItem>
                    {empresas.map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.id}>
                        {empresa.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Setor</Label>
                <Select value={selectedSetor} onValueChange={setSelectedSetor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {setores.map((setor) => (
                      <SelectItem key={setor.id} value={setor.id}>
                        {setor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mês</Label>
                <Select value={mes.toString()} onValueChange={(v) => setMes(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        {new Date(2000, m - 1).toLocaleString("pt-BR", { month: "long" })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ano</Label>
                <Select value={ano.toString()} onValueChange={(v) => setAno(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Contrato</Label>
                <Select value={tipoContrato} onValueChange={setTipoContrato}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="fixo">Fixo</SelectItem>
                    <SelectItem value="intermitente">Intermitente</SelectItem>
                    <SelectItem value="prestador_servico">Prestador de Serviço</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Folha</Label>
                <Select value={tipoFolha} onValueChange={setTipoFolha}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {TIPO_FOLHA_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedEmpresa && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 flex flex-wrap h-auto">
              <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
              <TabsTrigger value="variaveis">Variáveis</TabsTrigger>
              <TabsTrigger value="importar">Importar para assinatura</TabsTrigger>
              <TabsTrigger value="diferenca">Holerite Diferença</TabsTrigger>
              <TabsTrigger value="auditoria">Auditoria & Fiscalização</TabsTrigger>
            </TabsList>

            <TabsContent value="lancamentos">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <Button onClick={handleOpenLancamentoForm} disabled={loading}>
                    <Plus className="w-4 h-4 mr-2" />
                    Lançar Pagamentos
                  </Button>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">Funcionário:</Label>
                    <Select value={selectedEmployeeForLancamento} onValueChange={setSelectedEmployeeForLancamento}>
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os funcionários</SelectItem>
                        {(selectedTipoFolhaLancamento === "rescisao" ? employeesDemitidos : employees).map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.nome_completo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">Tipo de Folha:</Label>
                    <Select value={selectedTipoFolhaLancamento} onValueChange={setSelectedTipoFolhaLancamento}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPO_FOLHA_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {pagamentos.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir todos do mês
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir todos os holerites do mês?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação irá excluir <strong>{pagamentos.length}</strong> holerite(s) do período {mes.toString().padStart(2, "0")}/{ano} conforme os filtros aplicados. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteTodosDoMes}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir todos
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <div className="text-lg font-semibold">
                    Total: R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <Dialog open={showLancamentoForm} onOpenChange={setShowLancamentoForm}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      Lançar Pagamentos - {TIPO_FOLHA_OPTIONS.find(o => o.value === selectedTipoFolhaLancamento)?.label}
                      {selectedEmployeeForLancamento !== "all" && ` (${employees.find(e => e.id === selectedEmployeeForLancamento)?.nome_completo})`}
                    </DialogTitle>
                  </DialogHeader>
                  <LancamentoFolhaForm
                    employees={(() => {
                      const base = selectedTipoFolhaLancamento === "rescisao" ? employeesDemitidos : employees;
                      return selectedEmployeeForLancamento === "all" 
                        ? base 
                        : base.filter(e => e.id === selectedEmployeeForLancamento);
                    })()}
                    empresaId={selectedEmpresa}
                    mes={mes}
                    ano={ano}
                    tipoFolha={selectedTipoFolhaLancamento}
                    onSuccess={() => handleLancamentoSuccess(mes, ano)}
                    onCancel={() => setShowLancamentoForm(false)}
                  />
                </DialogContent>
              </Dialog>

              {/* Resumo por variável */}
              {resumoVariaveis.length > 0 && (
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle className="text-base">Resumo por Variável</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {resumoVariaveis.map(rv => (
                        <div key={rv.variavel} className={`flex justify-between p-2 rounded ${rv.tipo === 'provento' ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
                          <span className="text-sm">{rv.variavel} ({rv.funcionarios})</span>
                          <span className={`font-semibold text-sm ${rv.tipo === 'provento' ? 'text-green-600' : 'text-red-600'}`}>
                            R$ {rv.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Pagamentos - {new Date(ano, mes - 1).toLocaleString("pt-BR", { month: "long", year: "numeric" })}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {pagamentos.map((pag) => renderPagamentoCard(pag))}
                    {pagamentos.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum pagamento lançado para este período
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="historico">
              <div className="space-y-4">
                {resumosMensais.length === 0 ? (
                  <Card>
                    <CardContent className="py-8">
                      <p className="text-center text-muted-foreground">
                        Nenhum pagamento registrado
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  resumosMensais.map((resumo) => {
                    const key = `${resumo.ano}-${resumo.mes}`;
                    const isExpanded = expandedMonth === key;
                    const mesNome = new Date(resumo.ano, resumo.mes - 1).toLocaleString("pt-BR", { month: "long" });
                    
                    return (
                      <Collapsible key={key} open={isExpanded} onOpenChange={(open) => setExpandedMonth(open ? key : null)}>
                        <Card>
                          <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Calendar className="w-5 h-5 text-muted-foreground" />
                                  <CardTitle className="text-lg capitalize">
                                    {mesNome} {resumo.ano}
                                  </CardTitle>
                                  <span className="text-sm text-muted-foreground">
                                    ({resumo.totalPagamentos} pagamento{resumo.totalPagamentos !== 1 ? 's' : ''})
                                  </span>
                                </div>
                                <div className="flex items-center gap-6">
                                  <div className="text-right">
                                    <p className="text-xs text-muted-foreground">Total Bruto</p>
                                    <p className="font-semibold text-sm">R$ {resumo.totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-muted-foreground">Em Conta</p>
                                    <p className="font-bold">R$ {resumo.totalEmMaos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                                  </div>
                                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                </div>
                              </div>
                            </CardHeader>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <CardContent className="pt-0">
                              <div className="border-t pt-4 space-y-4">
                                {getPagamentosByMonth(resumo.mes, resumo.ano).map((pag) => renderPagamentoCard(pag))}
                              </div>
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    );
                  })
                )}
              </div>
            </TabsContent>

            <TabsContent value="variaveis">
              <VariaveisConfig empresaId={selectedEmpresa} />
            </TabsContent>

            <TabsContent value="importar">
              <ImportarHoleritesTab onImportComplete={handleImportComplete} />
            </TabsContent>

            <TabsContent value="diferenca">
              <HoleriteDiferencaLoteTab empresaId={selectedEmpresa} mes={mes} ano={ano} />
            </TabsContent>

            <TabsContent value="auditoria">
              <AuditoriaHoleritesTab empresaIdInicial={selectedEmpresa} />
            </TabsContent>
          </Tabs>
        )}

        <RelatorioDetalhadoDialog
          open={showRelatorioDialog}
          onOpenChange={setShowRelatorioDialog}
          pagamentos={pagamentos}
          empresaId={selectedEmpresa}
          empresaNome={empresas.find(e => e.id === selectedEmpresa)?.nome || "Todas as Empresas"}
          mes={mes}
          ano={ano}
        />

        <HoleriteDialog
          open={holeriteDialogOpen}
          onOpenChange={setHoleriteDialogOpen}
          pagamento={selectedPagamentoForHolerite}
          empresaId={selectedEmpresa}
        />
      </div>
    </div>
  );
};

export default Payroll;

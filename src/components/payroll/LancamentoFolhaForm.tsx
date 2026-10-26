import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, TrendingUp, TrendingDown, Plus, X, Loader2, Search, Save, ChevronLeft, ChevronRight, Check, Circle } from "lucide-react";
import { toast } from "sonner";
import { dataBR } from "@/lib/date";

interface Employee {
  id: string;
  nome_completo: string;
  cargo: string;
  setor: string | null;
  salario: number | null;
}

interface Variavel {
  id: string;
  nome: string;
  codigo: string | null;
  tipo: "desconto" | "provento";
  ativo: boolean;
}

interface LancamentoData {
  salario_base: number;
  observacoes: string;
  itens: Record<string, number>;
}

interface SavedDraftData {
  lancamentos: Record<string, LancamentoData>;
  selectedEmployee: string;
  savedAt: string;
}

interface LancamentoFolhaFormProps {
  employees: Employee[];
  empresaId: string;
  mes: number;
  ano: number;
  tipoFolha: string;
  onSuccess: (mes: number, ano: number) => void;
  onCancel: () => void;
}

const STORAGE_KEY_PREFIX = "folha_lancamento_draft_";

const TIPO_RESCISAO_OPTIONS = [
  { value: "sem_justa_causa", label: "Sem justa causa" },
  { value: "com_justa_causa", label: "Com justa causa" },
  { value: "pedido_demissao", label: "Pedido de demissão" },
  { value: "acordo_mutuo", label: "Acordo mútuo (Art. 484-A CLT)" },
  { value: "termino_contrato", label: "Término de contrato" },
  { value: "termino_antecipado", label: "Término antecipado de contrato" },
];

const LancamentoFolhaForm = ({ employees, empresaId, mes, ano, tipoFolha, onSuccess, onCancel }: LancamentoFolhaFormProps) => {
  const [variaveis, setVariaveis] = useState<Variavel[]>([]);
  const [lancamentos, setLancamentos] = useState<Record<string, LancamentoData>>({});
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>(employees[0]?.id || "");
  const [codigoBusca, setCodigoBusca] = useState<Record<string, string>>({});
  const [valorBusca, setValorBusca] = useState<Record<string, number>>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [openVariavelPicker, setOpenVariavelPicker] = useState<string | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [savedDraft, setSavedDraft] = useState<SavedDraftData | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [searchEmployee, setSearchEmployee] = useState("");
  const [addVarTipo, setAddVarTipo] = useState<"provento" | "desconto">("provento");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitializedRef = useRef(false);

  const [rescisaoData, setRescisaoData] = useState<Record<string, {
    tipo_rescisao: string;
    aviso_previo_cumprido: boolean;
  }>>({});

  const getStorageKey = useCallback(() => {
    return `${STORAGE_KEY_PREFIX}${empresaId}_${mes}_${ano}_${tipoFolha}`;
  }, [empresaId, mes, ano, tipoFolha]);

  const saveDraft = useCallback(() => {
    if (!isInitializedRef.current) return;
    const draftData: SavedDraftData = {
      lancamentos,
      selectedEmployee,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(draftData));
      setLastSaved(new Date());
    } catch (error) {
      console.error("Erro ao salvar rascunho:", error);
    }
  }, [lancamentos, selectedEmployee, getStorageKey]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(getStorageKey());
      setLastSaved(null);
    } catch (error) {
      console.error("Erro ao limpar rascunho:", error);
    }
  }, [getStorageKey]);

  useEffect(() => {
    const checkForDraft = () => {
      try {
        const savedData = localStorage.getItem(getStorageKey());
        if (savedData) {
          const parsed: SavedDraftData = JSON.parse(savedData);
          const hasData = Object.values(parsed.lancamentos).some(l =>
            l.salario_base > 0 || Object.keys(l.itens).length > 0 || l.observacoes
          );
          if (hasData) {
            setSavedDraft(parsed);
            setShowRestoreDialog(true);
            return;
          }
        }
      } catch (error) {
        console.error("Erro ao verificar rascunho:", error);
      }
      initializeLancamentos();
      isInitializedRef.current = true;
    };
    checkForDraft();
  }, [getStorageKey]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => { saveDraft(); }, 1000);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [lancamentos, selectedEmployee, saveDraft]);

  useEffect(() => { fetchVariaveis(); }, [empresaId]);

  const fetchVariaveis = async () => {
    let query = supabase.from("variaveis_folha").select("*").eq("ativo", true).order("tipo").order("nome");
    if (empresaId && empresaId !== "all") {
      query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
    }
    const { data, error } = await query;
    if (error) { console.error("Erro ao carregar variáveis:", error); return; }
    setVariaveis(data || []);
  };

  const initializeLancamentos = async () => {
    const employeeIds = employees.map(e => e.id);

    const [{ data: variaveisFixas }, { data: pagamentosExistentes }] = await Promise.all([
      supabase
        .from("variaveis_fixas_funcionario")
        .select("employee_id, variavel_id, valor")
        .eq("ativo", true)
        .in("employee_id", employeeIds),
      supabase
        .from("folha_pagamento")
        .select("employee_id, valor_bruto, observacoes, folha_pagamento_itens(variavel_id, valor, variaveis_folha(tipo))")
        .eq("mes", mes)
        .eq("ano", ano)
        .eq("tipo_folha", tipoFolha)
        .in("employee_id", employeeIds),
    ]);

    // Lançamentos já existentes (ex.: importados) para o mês/ano/tipo selecionado
    const porFuncionario = new Map<string, any>();
    (pagamentosExistentes || []).forEach((p: any) => {
      if (!porFuncionario.has(p.employee_id)) porFuncionario.set(p.employee_id, p);
    });

    const initial: Record<string, LancamentoData> = {};
    employees.forEach(emp => {
      const existente = porFuncionario.get(emp.id);
      if (existente) {
        const itens: Record<string, number> = {};
        let somaProventos = 0;
        (existente.folha_pagamento_itens || []).forEach((i: any) => {
          itens[i.variavel_id] = Number(i.valor);
          if (i.variaveis_folha?.tipo === "provento") somaProventos += Number(i.valor);
        });
        const base = Math.max(0, Number(existente.valor_bruto || 0) - somaProventos);
        initial[emp.id] = {
          salario_base: base,
          observacoes: existente.observacoes || "",
          itens,
        };
        return;
      }

      const fixedItems: Record<string, number> = {};
      variaveisFixas?.filter(vf => vf.employee_id === emp.id).forEach(vf => {
        fixedItems[vf.variavel_id] = Number(vf.valor);
      });
      initial[emp.id] = { salario_base: emp.salario || 0, observacoes: "", itens: fixedItems };
    });
    setLancamentos(initial);
  };

  const handleRestoreDraft = () => {
    if (savedDraft) {
      const merged: Record<string, LancamentoData> = {};
      employees.forEach(emp => {
        if (savedDraft.lancamentos[emp.id]) {
          merged[emp.id] = savedDraft.lancamentos[emp.id];
        } else {
          merged[emp.id] = { salario_base: emp.salario || 0, observacoes: "", itens: {} };
        }
      });
      setLancamentos(merged);
      if (savedDraft.selectedEmployee && employees.find(e => e.id === savedDraft.selectedEmployee)) {
        setSelectedEmployee(savedDraft.selectedEmployee);
      }
      toast.success("Rascunho restaurado com sucesso!");
    }
    setShowRestoreDialog(false);
    isInitializedRef.current = true;
  };

  const handleDiscardDraft = () => {
    clearDraft();
    initializeLancamentos();
    setShowRestoreDialog(false);
    isInitializedRef.current = true;
    toast.info("Rascunho descartado");
  };

  const handleCopiarMesAnterior = async () => {
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const anoAnterior = mes === 1 ? ano - 1 : ano;
    try {
      const { data: pagamentosAnteriores, error: pagError } = await supabase
        .from("folha_pagamento").select("*, folha_pagamento_itens(*)")
        .eq("empresa_id", empresaId).eq("mes", mesAnterior).eq("ano", anoAnterior);
      if (pagError) throw pagError;
      if (!pagamentosAnteriores || pagamentosAnteriores.length === 0) {
        toast.info("Nenhum lançamento encontrado no mês anterior"); return;
      }
      const newLancamentos = { ...lancamentos };
      pagamentosAnteriores.forEach((pag: any) => {
        if (newLancamentos[pag.employee_id]) {
          newLancamentos[pag.employee_id] = {
            salario_base: pag.valor_bruto - (pag.folha_pagamento_itens?.filter((i: any) => {
              const v = variaveis.find(v => v.id === i.variavel_id);
              return v?.tipo === "provento";
            }).reduce((sum: number, i: any) => sum + i.valor, 0) || 0),
            observacoes: pag.observacoes || "",
            itens: pag.folha_pagamento_itens?.reduce((acc: Record<string, number>, item: any) => {
              acc[item.variavel_id] = item.valor; return acc;
            }, {}) || {},
          };
        }
      });
      setLancamentos(newLancamentos);
      toast.success("Dados do mês anterior copiados!");
    } catch (error) {
      console.error("Erro ao copiar mês anterior:", error);
      toast.error("Erro ao copiar dados do mês anterior");
    }
  };

  const handleValueChange = (empId: string, field: "salario_base" | "observacoes", value: any) => {
    setLancamentos(prev => ({ ...prev, [empId]: { ...prev[empId], [field]: value } }));
  };

  const handleItemChange = (empId: string, variavelId: string, valor: number) => {
    setLancamentos(prev => ({
      ...prev, [empId]: { ...prev[empId], itens: { ...prev[empId].itens, [variavelId]: valor } }
    }));
  };

  const calcularTotais = (empId: string) => {
    const lancamento = lancamentos[empId];
    if (!lancamento) return { proventos: 0, descontos: 0, liquido: 0 };
    let totalProventos = lancamento.salario_base;
    let totalDescontos = 0;
    Object.entries(lancamento.itens).forEach(([varId, valor]) => {
      const variavel = variaveis.find(v => v.id === varId);
      if (variavel?.tipo === "provento") totalProventos += valor;
      else if (variavel?.tipo === "desconto") totalDescontos += valor;
    });
    return { proventos: totalProventos, descontos: totalDescontos, liquido: totalProventos - totalDescontos };
  };

  const getResumoGeral = () => {
    let totalProventos = 0, totalDescontos = 0, totalLiquido = 0, funcionariosComDados = 0;
    employees.forEach(emp => {
      const totais = calcularTotais(emp.id);
      if (totais.proventos > 0 || totais.descontos > 0) {
        totalProventos += totais.proventos;
        totalDescontos += totais.descontos;
        totalLiquido += totais.liquido;
        funcionariosComDados++;
      }
    });
    return { totalProventos, totalDescontos, totalLiquido, funcionariosComDados };
  };

  const handleSubmit = async () => {
    setLoading(true);
    let sucessos = 0;
    let erros = 0;
    try {
      if (tipoFolha === "rescisao") {
        const semTipo = employees.filter(emp => {
          const lancamento = lancamentos[emp.id];
          if (!lancamento) return false;
          const totais = calcularTotais(emp.id);
          if (totais.proventos === 0 && totais.descontos === 0) return false;
          return !rescisaoData[emp.id]?.tipo_rescisao;
        });
        if (semTipo.length > 0) {
          toast.error(`Preencha o tipo de rescisão para: ${semTipo.map(e => e.nome_completo).join(", ")}`);
          setLoading(false); setShowConfirmDialog(false); return;
        }
      }
      for (const emp of employees) {
        const lancamento = lancamentos[emp.id];
        if (!lancamento) continue;
        const totais = calcularTotais(emp.id);
        if (totais.proventos === 0 && totais.descontos === 0) continue;
        try {
          const { data: existingPag } = await supabase
            .from("folha_pagamento").select("id")
            .eq("employee_id", emp.id).eq("mes", mes).eq("ano", ano).eq("tipo_folha", tipoFolha).maybeSingle();
          let pagamentoId: string;
          const rescisaoInfo = tipoFolha === "rescisao" ? rescisaoData[emp.id] : null;
          if (existingPag) {
            const updateData: any = {
              valor_bruto: totais.proventos, desconto: totais.descontos, descontos: 0,
              valor_liquido: totais.liquido, observacoes: lancamento.observacoes || null,
            };
            if (rescisaoInfo) {
              updateData.tipo_rescisao = rescisaoInfo.tipo_rescisao || null;
              updateData.aviso_previo_cumprido = rescisaoInfo.aviso_previo_cumprido;
            }
            const { data: updatedPag, error: updateError } = await supabase
              .from("folha_pagamento").update(updateData).eq("id", existingPag.id).select().single();
            if (updateError) throw updateError;
            pagamentoId = updatedPag.id;
          } else {
            const { data: newPag, error: insertError } = await supabase
              .from("folha_pagamento").insert({
                employee_id: emp.id, empresa_id: empresaId, mes, ano, tipo_folha: tipoFolha,
                valor_bruto: totais.proventos, desconto: totais.descontos, descontos: 0,
                valor_liquido: totais.liquido, observacoes: lancamento.observacoes || null,
                ...(rescisaoInfo ? { tipo_rescisao: rescisaoInfo.tipo_rescisao || null, aviso_previo_cumprido: rescisaoInfo.aviso_previo_cumprido } : {}),
              } as any).select().single();
            if (insertError) throw insertError;
            pagamentoId = newPag.id;
          }
          await supabase.from("folha_pagamento_itens").delete().eq("folha_pagamento_id", pagamentoId);
          const itensParaInserir = Object.entries(lancamento.itens)
            .filter(([_, valor]) => valor > 0)
            .map(([varId, valor]) => ({ folha_pagamento_id: pagamentoId, variavel_id: varId, valor }));
          if (itensParaInserir.length > 0) {
            const { error: itensError } = await supabase.from("folha_pagamento_itens").insert(itensParaInserir);
            if (itensError) throw itensError;
          }
          sucessos++;
        } catch (err) { console.error(`Erro ao processar ${emp.nome_completo}:`, err); erros++; }
      }
      if (sucessos > 0) { clearDraft(); toast.success(`${sucessos} pagamento(s) lançado(s) com sucesso!`); onSuccess(mes, ano); }
      if (erros > 0) toast.error(`${erros} pagamento(s) com erro`);
      if (sucessos === 0 && erros === 0) toast.warning("Nenhum pagamento para lançar. Verifique os valores.");
    } catch (error) { console.error("Erro ao lançar pagamentos:", error); toast.error("Erro ao lançar pagamentos"); }
    finally { setLoading(false); setShowConfirmDialog(false); }
  };

  const handleCancel = () => { clearDraft(); onCancel(); };

  const handleBuscarVariavel = (empId: string, tipo: "provento" | "desconto") => {
    const codigo = codigoBusca[`${empId}-${tipo}`]?.trim();
    const valor = valorBusca[`${empId}-${tipo}`] || 0;
    if (!codigo) { setOpenVariavelPicker(`${empId}-${tipo}`); return; }
    const variavel = variaveis.find(v => v.codigo?.toLowerCase() === codigo.toLowerCase() && v.tipo === tipo);
    if (!variavel) {
      const variavelOutroTipo = variaveis.find(v => v.codigo?.toLowerCase() === codigo.toLowerCase());
      if (variavelOutroTipo) { toast.error(`O código "${codigo}" está cadastrado como ${variavelOutroTipo.tipo}. Adicione na seção correta.`); return; }
      toast.error(`Variável com código "${codigo}" não encontrada`); return;
    }
    if (valor <= 0) { toast.error("Digite um valor maior que zero"); return; }
    handleItemChange(empId, variavel.id, valor);
    setCodigoBusca(prev => ({ ...prev, [`${empId}-${tipo}`]: "" }));
    setValorBusca(prev => ({ ...prev, [`${empId}-${tipo}`]: 0 }));
    toast.success(`${variavel.nome} adicionado`);
  };

  const handleSelectVariavelFromPicker = (empId: string, tipo: "provento" | "desconto", variavel: Variavel) => {
    const valor = valorBusca[`${empId}-${tipo}`] || 0;
    if (valor <= 0) {
      setCodigoBusca(prev => ({ ...prev, [`${empId}-${tipo}`]: variavel.codigo || variavel.nome }));
      setOpenVariavelPicker(null);
      toast.info(`"${variavel.nome}" selecionado. Digite o valor e pressione Enter.`);
      return;
    }
    handleItemChange(empId, variavel.id, valor);
    setCodigoBusca(prev => ({ ...prev, [`${empId}-${tipo}`]: "" }));
    setValorBusca(prev => ({ ...prev, [`${empId}-${tipo}`]: 0 }));
    setOpenVariavelPicker(null);
    toast.success(`${variavel.nome} adicionado`);
  };

  const handleRemoveItem = (empId: string, variavelId: string) => {
    setLancamentos(prev => {
      const newItens = { ...prev[empId].itens };
      delete newItens[variavelId];
      return { ...prev, [empId]: { ...prev[empId], itens: newItens } };
    });
  };

  const getVariaveisComValor = (empId: string) => {
    const lancamento = lancamentos[empId];
    if (!lancamento) return [];
    return Object.entries(lancamento.itens)
      .filter(([_, valor]) => valor > 0)
      .map(([varId, valor]) => {
        const variavel = variaveis.find(v => v.id === varId);
        return variavel ? { ...variavel, valor } : null;
      })
      .filter(Boolean) as (Variavel & { valor: number })[];
  };

  const empHasData = (empId: string) => {
    const lancamento = lancamentos[empId];
    if (!lancamento) return false;
    const totais = calcularTotais(empId);
    return totais.proventos > 0 || totais.descontos > 0;
  };

  const resumoGeral = getResumoGeral();

  // Navigation helpers
  const currentIndex = employees.findIndex(e => e.id === selectedEmployee);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < employees.length - 1;
  const goToPrev = () => { if (canGoPrev) setSelectedEmployee(employees[currentIndex - 1].id); };
  const goToNext = () => { if (canGoNext) setSelectedEmployee(employees[currentIndex + 1].id); };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F8") { e.preventDefault(); goToPrev(); }
      if (e.key === "F9") { e.preventDefault(); goToNext(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, employees]);

  const filteredEmployees = employees.filter(emp =>
    emp.nome_completo.toLowerCase().includes(searchEmployee.toLowerCase())
  );

  const emp = employees.find(e => e.id === selectedEmployee);
  const lancamento = emp ? lancamentos[emp.id] : null;
  const totais = emp ? calcularTotais(emp.id) : { proventos: 0, descontos: 0, liquido: 0 };
  const itensAdicionados = emp ? getVariaveisComValor(emp.id) : [];
  const proventosAdicionados = itensAdicionados.filter(v => v.tipo === "provento");
  const descontosAdicionados = itensAdicionados.filter(v => v.tipo === "desconto");

  const formatCurrency = (val: number) => `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Summary Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg mb-3">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold">
            {new Date(ano, mes - 1).toLocaleString("pt-BR", { month: "long", year: "numeric" })}
          </h3>
          <Badge variant="outline" className="font-normal">
            {resumoGeral.funcionariosComDados} de {employees.length} preenchidos
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-green-600 font-medium">Prov: {formatCurrency(resumoGeral.totalProventos)}</span>
          <span className="text-red-600 font-medium">Desc: {formatCurrency(resumoGeral.totalDescontos)}</span>
          <span className="text-primary font-bold">Líq: {formatCurrency(resumoGeral.totalLiquido)}</span>
          <Button variant="outline" size="sm" onClick={handleCopiarMesAnterior}>
            <Copy className="w-3 h-3 mr-1" /> Copiar Mês Anterior
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Sidebar - Employee List */}
        <div className="w-[250px] shrink-0 border rounded-lg flex flex-col bg-card">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchEmployee}
                onChange={e => setSearchEmployee(e.target.value)}
                className="h-8 pl-7 text-sm"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-1">
              {filteredEmployees.map(e => {
                const hasData = empHasData(e.id);
                const isActive = e.id === selectedEmployee;
                return (
                  <button
                    key={e.id}
                    onClick={() => setSelectedEmployee(e.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                      isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                    }`}
                  >
                    {hasData ? (
                      <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                    )}
                    <span className="truncate">{e.nome_completo}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Main Panel - Selected Employee */}
        {emp && lancamento ? (
          <div className="flex-1 border rounded-lg flex flex-col bg-card min-h-0">
            {/* Employee header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <p className="font-semibold text-lg">{emp.nome_completo}</p>
                <p className="text-sm text-muted-foreground">{emp.cargo}{emp.setor ? ` • ${emp.setor}` : ""}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Valor em Mãos</p>
                <p className={`text-xl font-bold ${totais.liquido >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {formatCurrency(totais.liquido)}
                </p>
              </div>
            </div>

            {/* Scrollable content */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {/* Rescisão fields */}
                {tipoFolha === "rescisao" && (
                  <div className="p-3 bg-muted/40 rounded-lg space-y-3 border border-dashed">
                    <p className="font-semibold text-sm">Dados da Rescisão</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm">Tipo de Rescisão</Label>
                        <Select
                          value={rescisaoData[emp.id]?.tipo_rescisao || ""}
                          onValueChange={(v) => setRescisaoData(prev => ({
                            ...prev, [emp.id]: { ...prev[emp.id], tipo_rescisao: v, aviso_previo_cumprido: prev[emp.id]?.aviso_previo_cumprido ?? false }
                          }))}
                        >
                          <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                          <SelectContent>
                            {TIPO_RESCISAO_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Aviso Prévio</Label>
                        <Select
                          value={rescisaoData[emp.id]?.aviso_previo_cumprido ? "sim" : "nao"}
                          onValueChange={(v) => setRescisaoData(prev => ({
                            ...prev, [emp.id]: { ...prev[emp.id], tipo_rescisao: prev[emp.id]?.tipo_rescisao || "", aviso_previo_cumprido: v === "sim" }
                          }))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sim">Cumprido</SelectItem>
                            <SelectItem value="nao">Não cumprido / Indenizado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Salário base */}
                <div className="flex items-center gap-3">
                  <Label className="text-sm w-24 shrink-0">Salário Base</Label>
                  <Input
                    type="number" step="0.01"
                    value={lancamento.salario_base}
                    onChange={(e) => handleValueChange(emp.id, "salario_base", parseFloat(e.target.value) || 0)}
                    className="max-w-[200px]"
                  />
                </div>

                {/* Proventos table */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="w-4 h-4" /> Proventos
                  </Label>
                  {proventosAdicionados.length > 0 ? (
                    <div className="border rounded-md overflow-hidden">
                      {proventosAdicionados.map(v => (
                        <div key={v.id} className="flex items-center gap-2 px-3 py-1.5 border-b last:border-b-0 hover:bg-muted/30">
                          {v.codigo && <Badge variant="outline" className="font-mono text-xs shrink-0">{v.codigo}</Badge>}
                          <span className="text-sm flex-1 truncate">{v.nome}</span>
                          <Input
                            type="number" step="0.01" value={v.valor}
                            onChange={(e) => handleItemChange(emp.id, v.id, parseFloat(e.target.value) || 0)}
                            className="w-28 h-8"
                          />
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveItem(emp.id, v.id)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Nenhum provento adicionado</p>
                  )}
                  <div className="flex justify-end text-sm font-semibold text-green-600">
                    Total: {formatCurrency(totais.proventos)}
                  </div>
                </div>

                {/* Descontos table */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-red-600">
                    <TrendingDown className="w-4 h-4" /> Descontos
                  </Label>
                  {descontosAdicionados.length > 0 ? (
                    <div className="border rounded-md overflow-hidden">
                      {descontosAdicionados.map(v => (
                        <div key={v.id} className="flex items-center gap-2 px-3 py-1.5 border-b last:border-b-0 hover:bg-muted/30">
                          {v.codigo && <Badge variant="outline" className="font-mono text-xs shrink-0">{v.codigo}</Badge>}
                          <span className="text-sm flex-1 truncate">{v.nome}</span>
                          <Input
                            type="number" step="0.01" value={v.valor}
                            onChange={(e) => handleItemChange(emp.id, v.id, parseFloat(e.target.value) || 0)}
                            className="w-28 h-8"
                          />
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveItem(emp.id, v.id)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Nenhum desconto adicionado</p>
                  )}
                  <div className="flex justify-end text-sm font-semibold text-red-600">
                    Total: {formatCurrency(totais.descontos)}
                  </div>
                </div>

                {/* Unified add variable */}
                <div className="p-3 bg-muted/20 rounded-lg space-y-2">
                  <Label className="text-sm font-medium">Adicionar variável</Label>
                  <div className="flex items-center gap-2">
                    <Select value={addVarTipo} onValueChange={(v: "provento" | "desconto") => setAddVarTipo(v)}>
                      <SelectTrigger className="w-[130px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="provento">Provento</SelectItem>
                        <SelectItem value="desconto">Desconto</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative">
                      <Input
                        placeholder="Código"
                        value={codigoBusca[`${emp.id}-${addVarTipo}`] || ""}
                        onChange={(e) => setCodigoBusca(prev => ({ ...prev, [`${emp.id}-${addVarTipo}`]: e.target.value }))}
                        className="w-28 h-9"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); handleBuscarVariavel(emp.id, addVarTipo); }
                        }}
                      />
                      <Popover
                        open={openVariavelPicker === `${emp.id}-${addVarTipo}`}
                        onOpenChange={(open) => setOpenVariavelPicker(open ? `${emp.id}-${addVarTipo}` : null)}
                      >
                        <PopoverTrigger asChild>
                          <span className="absolute inset-0 pointer-events-none" />
                        </PopoverTrigger>
                        <PopoverContent className="w-[280px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar variável..." />
                            <CommandList>
                              <CommandEmpty>Nenhuma variável encontrada</CommandEmpty>
                              <CommandGroup heading={addVarTipo === "provento" ? "Proventos" : "Descontos"}>
                                {variaveis
                                  .filter(v => v.tipo === addVarTipo && !lancamentos[emp.id]?.itens[v.id])
                                  .map(v => (
                                    <CommandItem
                                      key={v.id}
                                      value={`${v.nome} ${v.codigo || ""}`}
                                      onSelect={() => handleSelectVariavelFromPicker(emp.id, addVarTipo, v)}
                                    >
                                      <div className="flex items-center gap-2 w-full">
                                        {v.codigo && <Badge variant="outline" className="font-mono text-xs">{v.codigo}</Badge>}
                                        <span className="text-sm">{v.nome}</span>
                                      </div>
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Input
                      type="number" step="0.01" placeholder="Valor"
                      value={valorBusca[`${emp.id}-${addVarTipo}`] || ""}
                      onChange={(e) => setValorBusca(prev => ({ ...prev, [`${emp.id}-${addVarTipo}`]: parseFloat(e.target.value) || 0 }))}
                      className="flex-1 h-9"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); handleBuscarVariavel(emp.id, addVarTipo); }
                      }}
                    />
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => handleBuscarVariavel(emp.id, addVarTipo)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Digite o código + valor e pressione Enter, ou Enter vazio para buscar</p>
                </div>

                {/* Observações */}
                <div>
                  <Label className="text-sm">Observações</Label>
                  <Textarea
                    value={lancamento.observacoes}
                    onChange={(e) => handleValueChange(emp.id, "observacoes", e.target.value)}
                    rows={2}
                    placeholder="Observações opcionais..."
                    className="mt-1"
                  />
                </div>
              </div>
            </ScrollArea>

            {/* Footer with navigation */}
            <div className="flex items-center justify-between p-3 border-t bg-muted/10">
              <Button variant="outline" size="sm" onClick={goToPrev} disabled={!canGoPrev}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
              </Button>
              <span className="text-xs text-muted-foreground">{currentIndex + 1} / {employees.length}</span>
              <Button variant="outline" size="sm" onClick={goToNext} disabled={!canGoNext}>
                Próximo <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 border rounded-lg flex items-center justify-center text-muted-foreground">
            Selecione um funcionário
          </div>
        )}
      </div>

      {/* Action buttons */}
      <Separator className="my-3" />
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleCancel} disabled={loading}>Cancelar</Button>
          {lastSaved && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Save className="w-3 h-3" />
              Salvo às {lastSaved.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <Button onClick={() => setShowConfirmDialog(true)} disabled={loading || resumoGeral.funcionariosComDados === 0}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Lançar Pagamentos
        </Button>
      </div>

      {/* Confirm dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Lançamento</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Você está prestes a lançar pagamentos com os seguintes totais:</p>
                <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg">
                  <span>Funcionários:</span><span className="font-semibold">{resumoGeral.funcionariosComDados}</span>
                  <span>Total Proventos:</span><span className="font-semibold text-green-600">{formatCurrency(resumoGeral.totalProventos)}</span>
                  <span>Total Descontos:</span><span className="font-semibold text-red-600">{formatCurrency(resumoGeral.totalDescontos)}</span>
                  <span>Total Líquido:</span><span className="font-semibold text-primary">{formatCurrency(resumoGeral.totalLiquido)}</span>
                </div>
                <p className="text-sm text-muted-foreground">Esta ação irá criar ou atualizar os registros de pagamento para o período selecionado.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore draft dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rascunho Encontrado</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Foi encontrado um rascunho salvo automaticamente para este período.</p>
                {savedDraft && (
                  <p className="text-sm text-muted-foreground">Salvo em: {dataBR(savedDraft.savedAt).toLocaleString("pt-BR")}</p>
                )}
                <p>Deseja restaurar os dados do rascunho ou começar do zero?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardDraft}>Começar do Zero</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreDraft}>Restaurar Rascunho</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LancamentoFolhaForm;

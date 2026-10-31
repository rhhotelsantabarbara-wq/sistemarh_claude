import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, FileDown, Receipt, BarChart, Pencil, Trash2, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { dataBR } from "@/lib/date";

interface Employee {
  id: string;
  nome_completo: string;
  cargo: string;
  setor: string | null;
  empresa_id: string | null;
  tipo_contrato: string | null;
}

type FormaPagamento = "em_conta" | "em_maos" | "emprestimo" | "consumo";

const FORMAS_PAGAMENTO: { value: FormaPagamento; label: string }[] = [
  { value: "em_conta", label: "Em conta" },
  { value: "em_maos", label: "Em mãos" },
  { value: "emprestimo", label: "Empréstimo" },
  { value: "consumo", label: "Consumo" },
];

const getFormaPagamentoLabel = (forma: string): string => {
  return FORMAS_PAGAMENTO.find(f => f.value === forma)?.label || forma;
};

interface AdiantamentoEntry {
  employee_id: string;
  nome_completo: string;
  valor: string;
  forma_pagamento: FormaPagamento;
}

interface AdiantamentoHistorico {
  id: string;
  employee_id: string;
  empresa_id: string;
  valor: number;
  forma_pagamento: string;
  status: string;
  mes: number;
  ano: number;
  created_at: string;
  employees: {
    nome_completo: string;
    setor: string | null;
    cargo: string;
  };
  empresas: {
    nome: string;
  };
}

interface Company {
  id: string;
  nome: string;
}

const Adiantamentos = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Filtros
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>("all");
  const [selectedSetor, setSelectedSetor] = useState<string>("all");
  const [selectedTipoContrato, setSelectedTipoContrato] = useState<string>("all");
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  
  // Adiantamentos
  const [adiantamentos, setAdiantamentos] = useState<AdiantamentoEntry[]>([]);
  
  // Histórico
  const [historico, setHistorico] = useState<AdiantamentoHistorico[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [filtroHistoricoMes, setFiltroHistoricoMes] = useState<number>(new Date().getMonth() + 1);
  const [filtroHistoricoAno, setFiltroHistoricoAno] = useState<number>(new Date().getFullYear());
  const [filtroHistoricoEmpresa, setFiltroHistoricoEmpresa] = useState<string>("all");
  const [filtroHistoricoSetor, setFiltroHistoricoSetor] = useState<string>("all");
  const [filtroHistoricoFormaPagamento, setFiltroHistoricoFormaPagamento] = useState<string>("all");

  // Edição
  const [editingAdiantamento, setEditingAdiantamento] = useState<AdiantamentoHistorico | null>(null);
  const [editingValor, setEditingValor] = useState<string>("");
  const [editingFormaPagamento, setEditingFormaPagamento] = useState<FormaPagamento>("em_conta");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  
  const setores = Array.from(new Set(employees.map(e => e.setor).filter(Boolean))) as string[];
  const tiposContrato = ["fixo", "intermitente", "Prestador de Serviço"];

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchHistorico();
  }, [filtroHistoricoMes, filtroHistoricoAno, filtroHistoricoEmpresa, filtroHistoricoSetor, filtroHistoricoFormaPagamento]);

  useEffect(() => {
    // Atualizar lista de adiantamentos quando filtros mudarem
    const filtered = employees.filter(emp => {
      if (selectedEmpresa !== "all" && emp.empresa_id !== selectedEmpresa) return false;
      if (selectedSetor !== "all" && emp.setor !== selectedSetor) return false;
      if (selectedTipoContrato !== "all" && emp.tipo_contrato !== selectedTipoContrato) return false;
      return true;
    });

    setAdiantamentos(filtered.map(emp => ({
      employee_id: emp.id,
      nome_completo: emp.nome_completo,
      valor: "",
      forma_pagamento: "em_conta" as const
    })));
  }, [selectedEmpresa, selectedSetor, selectedTipoContrato, employees]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [employeesResult, companiesResult] = await Promise.all([
        supabase
          .from("employees")
          .select("id, nome_completo, cargo, setor, empresa_id, tipo_contrato")
          .in("status", ["ativo", "ferias"])
          .order("nome_completo"),
        supabase
          .from("empresas")
          .select("id, nome")
          .order("nome")
      ]);

      if (employeesResult.error) throw employeesResult.error;
      if (companiesResult.error) throw companiesResult.error;

      setEmployees(employeesResult.data || []);
      setCompanies(companiesResult.data || []);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistorico = async () => {
    try {
      setLoadingHistorico(true);

      let query = supabase
        .from("adiantamentos")
        .select(`
          *,
          employees!inner(nome_completo, setor, cargo),
          empresas!inner(nome)
        `)
        .eq("mes", filtroHistoricoMes)
        .eq("ano", filtroHistoricoAno)
        .order("created_at", { ascending: false });

      if (filtroHistoricoEmpresa !== "all") {
        query = query.eq("empresa_id", filtroHistoricoEmpresa);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filtrar por setor e forma de pagamento se selecionado
      let filtered = data || [];
      if (filtroHistoricoSetor !== "all") {
        filtered = filtered.filter(a => a.employees.setor === filtroHistoricoSetor);
      }
      if (filtroHistoricoFormaPagamento !== "all") {
        filtered = filtered.filter(a => a.forma_pagamento === filtroHistoricoFormaPagamento);
      }

      // Ordenar alfabeticamente por nome do funcionário
      filtered.sort((a, b) => a.employees.nome_completo.localeCompare(b.employees.nome_completo));

      setHistorico(filtered);
    } catch (error: any) {
      console.error("Erro ao carregar histórico:", error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoadingHistorico(false);
    }
  };

  const handleValorChange = (employeeId: string, valor: string) => {
    setAdiantamentos(prev => 
      prev.map(adiant => 
        adiant.employee_id === employeeId 
          ? { ...adiant, valor } 
          : adiant
      )
    );
  };

  const handleFormaPagamentoChange = (employeeId: string, forma: FormaPagamento) => {
    setAdiantamentos(prev => 
      prev.map(adiant => 
        adiant.employee_id === employeeId 
          ? { ...adiant, forma_pagamento: forma } 
          : adiant
      )
    );
  };

  const handleSaveAdiantamentos = async () => {
    try {
      setSaving(true);

      // Filtrar apenas adiantamentos com valor preenchido
      const adiantamentosComValor = adiantamentos.filter(
        (a) => a.valor && parseFloat(a.valor) > 0
      );

      if (adiantamentosComValor.length === 0) {
        toast.error("Preencha pelo menos um valor de adiantamento");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Validar empresa vinculada (empresa_id é obrigatório na tabela)
      const funcionariosSemEmpresa = adiantamentosComValor
        .map((a) => {
          const employee = employees.find((e) => e.id === a.employee_id);
          return {
            nome: employee?.nome_completo ?? a.nome_completo,
            empresa_id: employee?.empresa_id ?? null,
          };
        })
        .filter((x) => !x.empresa_id)
        .map((x) => x.nome);

      if (funcionariosSemEmpresa.length > 0) {
        toast.error(
          `Não foi possível salvar: funcionário(s) sem empresa vinculada: ${funcionariosSemEmpresa.join(
            ", "
          )}`
        );
        return;
      }

      // Preparar dados para inserção
      const inserts = adiantamentosComValor.map((a) => {
        const employee = employees.find((e) => e.id === a.employee_id);

        return {
          employee_id: a.employee_id,
          empresa_id: employee!.empresa_id as string,
          valor: parseFloat(a.valor),
          forma_pagamento: a.forma_pagamento,
          mes,
          ano,
          created_by: user.id,
        };
      });

      const { error } = await supabase.from("adiantamentos").insert(inserts);

      if (error) throw error;

      toast.success(
        `${adiantamentosComValor.length} adiantamento(s) lançado(s) com sucesso!`
      );

      // Limpar valores
      setAdiantamentos((prev) => prev.map((a) => ({ ...a, valor: "" })));

      // Recarregar histórico
      fetchHistorico();
    } catch (error: any) {
      console.error(
        "Erro ao salvar adiantamentos:",
        error,
        error?.message,
        error?.details,
        error?.hint,
        error?.code
      );
      toast.error(error?.message || "Erro ao salvar adiantamentos");
    } finally {
      setSaving(false);
    }
  };

  const handleExportHistoricoPDF = () => {
    try {
      if (historico.length === 0) {
        toast.error("Não há histórico para exportar");
        return;
      }

      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text("Histórico de Adiantamentos", 14, 20);
      
      doc.setFontSize(11);
      doc.text(`Período: ${filtroHistoricoMes.toString().padStart(2, '0')}/${filtroHistoricoAno}`, 14, 30);
      if (filtroHistoricoEmpresa !== "all") {
        const empresa = companies.find(c => c.id === filtroHistoricoEmpresa);
        doc.text(`Empresa: ${empresa?.nome || ""}`, 14, 36);
      }
      if (filtroHistoricoSetor !== "all") {
        doc.text(`Setor: ${filtroHistoricoSetor}`, 14, 42);
      }
      
      // Ordenar alfabeticamente por nome do funcionário
      const historicoOrdenado = [...historico].sort((a, b) => 
        a.employees.nome_completo.localeCompare(b.employees.nome_completo)
      );
      
      const tableData = historicoOrdenado.map(a => [
        a.employees.nome_completo,
        a.employees.setor || "-",
        a.empresas.nome,
        `R$ ${a.valor.toFixed(2)}`,
        getFormaPagamentoLabel(a.forma_pagamento),
        dataBR(a.created_at).toLocaleDateString("pt-BR")
      ]);

      autoTable(doc, {
        startY: filtroHistoricoSetor !== "all" ? 48 : (filtroHistoricoEmpresa !== "all" ? 42 : 35),
        head: [["Funcionário", "Setor", "Empresa", "Valor", "Forma Pagamento", "Data"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [79, 70, 229] }
      });

      const total = historico.reduce((sum, a) => sum + a.valor, 0);
      const finalY = (doc as any).lastAutoTable.finalY || 35;
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`Total Geral: R$ ${total.toFixed(2)}`, 14, finalY + 10);
      doc.text(`Quantidade de Registros: ${historico.length}`, 14, finalY + 17);

      doc.save(`historico_adiantamentos_${filtroHistoricoMes}_${filtroHistoricoAno}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  const handleOpenEdit = (adiantamento: AdiantamentoHistorico) => {
    setEditingAdiantamento(adiantamento);
    setEditingValor(adiantamento.valor.toString());
    setEditingFormaPagamento(adiantamento.forma_pagamento as FormaPagamento);
  };

  const handleSaveEdit = async () => {
    if (!editingAdiantamento) return;
    
    try {
      setSavingEdit(true);
      
      const { error } = await supabase
        .from("adiantamentos")
        .update({
          valor: parseFloat(editingValor),
          forma_pagamento: editingFormaPagamento
        })
        .eq("id", editingAdiantamento.id);

      if (error) throw error;

      toast.success("Adiantamento atualizado com sucesso!");
      setEditingAdiantamento(null);
      fetchHistorico();
    } catch (error: any) {
      console.error("Erro ao atualizar adiantamento:", error);
      toast.error("Erro ao atualizar adiantamento");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteAdiantamento = async (id: string) => {
    try {
      const { error } = await supabase
        .from("adiantamentos")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Adiantamento excluído com sucesso!");
      fetchHistorico();
    } catch (error: any) {
      console.error("Erro ao excluir adiantamento:", error);
      toast.error("Erro ao excluir adiantamento");
    }
  };

  const handleDeleteAllAdiantamentos = async () => {
    if (historico.length === 0) return;
    
    try {
      setDeletingAll(true);
      
      const ids = historico.map(a => a.id);
      
      const { error } = await supabase
        .from("adiantamentos")
        .delete()
        .in("id", ids);

      if (error) throw error;

      toast.success(`${ids.length} adiantamento(s) excluído(s) com sucesso!`);
      fetchHistorico();
    } catch (error: any) {
      console.error("Erro ao excluir adiantamentos:", error);
      toast.error("Erro ao excluir adiantamentos");
    } finally {
      setDeletingAll(false);
    }
  };

  const handleConfirmAdiantamento = async (id: string) => {
    try {
      const { error } = await supabase
        .from("adiantamentos")
        .update({ status: "feito" })
        .eq("id", id);

      if (error) throw error;

      toast.success("Adiantamento confirmado!");
      fetchHistorico();
    } catch (error: any) {
      console.error("Erro ao confirmar adiantamento:", error);
      toast.error("Erro ao confirmar adiantamento");
    }
  };

  const handleExportPDF = () => {
    try {
      const adiantamentosComValor = adiantamentos.filter(a => a.valor && parseFloat(a.valor) > 0);

      if (adiantamentosComValor.length === 0) {
        toast.error("Não há adiantamentos para exportar");
        return;
      }

      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text("Relatório de Adiantamentos", 14, 20);
      
      doc.setFontSize(11);
      doc.text(`Mês/Ano: ${mes.toString().padStart(2, '0')}/${ano}`, 14, 30);
      
      const tableData = adiantamentosComValor.map(a => [
        a.nome_completo,
        `R$ ${parseFloat(a.valor).toFixed(2)}`,
        getFormaPagamentoLabel(a.forma_pagamento)
      ]);

      autoTable(doc, {
        startY: 35,
        head: [["Funcionário", "Valor", "Forma de Pagamento"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [79, 70, 229] }
      });

      const total = adiantamentosComValor.reduce((sum, a) => sum + parseFloat(a.valor), 0);
      const finalY = (doc as any).lastAutoTable.finalY || 35;
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`Total: R$ ${total.toFixed(2)}`, 14, finalY + 10);

      doc.save(`adiantamentos_${mes}_${ano}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-0 sm:p-2 lg:p-4 space-y-6">
      <h1 className="text-xl font-medium leading-tight">Adiantamentos Mensais</h1>

      <Tabs defaultValue="lancamentos" className="space-y-6">
        <TabsList>
          <TabsTrigger value="lancamentos" className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Lançamentos
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="flex items-center gap-2">
            <BarChart className="w-4 h-4" />
            Relatórios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lancamentos" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={handleExportPDF} variant="outline">
              <FileDown className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
          </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div>
            <Label>Mês</Label>
            <Select value={mes.toString()} onValueChange={(v) => setMes(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <SelectItem key={m} value={m.toString()}>
                    {new Date(2024, m - 1, 1).toLocaleString('pt-BR', { month: 'long' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Ano</Label>
            <Input
              type="number"
              value={ano}
              onChange={(e) => setAno(parseInt(e.target.value))}
            />
          </div>

          <div>
            <Label>Empresa</Label>
            <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Setor</Label>
            <Select value={selectedSetor} onValueChange={setSelectedSetor}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {setores.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tipo de Contrato</Label>
            <Select value={selectedTipoContrato} onValueChange={setSelectedTipoContrato}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {tiposContrato.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Valor (R$)</TableHead>
                <TableHead>Forma de Pagamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adiantamentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum funcionário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                adiantamentos.map(adiant => {
                  const employee = employees.find(e => e.id === adiant.employee_id);
                  return (
                    <TableRow key={adiant.employee_id}>
                      <TableCell className="font-medium">{adiant.nome_completo}</TableCell>
                      <TableCell>{employee?.cargo}</TableCell>
                      <TableCell>{employee?.setor || "-"}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={adiant.valor}
                          onChange={(e) => handleValorChange(adiant.employee_id, e.target.value)}
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                      <Select
                          value={adiant.forma_pagamento}
                          onValueChange={(v) => handleFormaPagamentoChange(adiant.employee_id, v as FormaPagamento)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FORMAS_PAGAMENTO.map(f => (
                              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleSaveAdiantamentos} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Lançar Adiantamentos
          </Button>
        </div>
      </Card>
        </TabsContent>

        <TabsContent value="relatorios" className="space-y-6">
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <div>
                <Label>Mês</Label>
                <Select value={filtroHistoricoMes.toString()} onValueChange={(v) => setFiltroHistoricoMes(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <SelectItem key={m} value={m.toString()}>
                        {new Date(2024, m - 1, 1).toLocaleString('pt-BR', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Ano</Label>
                <Input
                  type="number"
                  value={filtroHistoricoAno}
                  onChange={(e) => setFiltroHistoricoAno(parseInt(e.target.value))}
                />
              </div>

              <div>
                <Label>Empresa</Label>
                <Select value={filtroHistoricoEmpresa} onValueChange={setFiltroHistoricoEmpresa}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Setor</Label>
                <Select value={filtroHistoricoSetor} onValueChange={setFiltroHistoricoSetor}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {setores.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Forma de Pagamento</Label>
                <Select value={filtroHistoricoFormaPagamento} onValueChange={setFiltroHistoricoFormaPagamento}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {FORMAS_PAGAMENTO.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Histórico de Adiantamentos ({historico.length} registros)
              </h3>
              <div className="flex gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      disabled={historico.length === 0 || deletingAll}
                    >
                      {deletingAll ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      Excluir Todos do Mês
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar exclusão em massa</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir todos os {historico.length} adiantamentos do mês {filtroHistoricoMes.toString().padStart(2, '0')}/{filtroHistoricoAno}?
                        Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAllAdiantamentos}>
                        Excluir Todos
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button onClick={handleExportHistoricoPDF} variant="outline" disabled={historico.length === 0}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Exportar PDF
                </Button>
              </div>
            </div>

            {loadingHistorico ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Setor</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Valor (R$)</TableHead>
                        <TableHead>Forma Pagamento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Lançamento</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historico.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground">
                            Nenhum adiantamento encontrado para este período
                          </TableCell>
                        </TableRow>
                      ) : (
                        historico.map(adiant => (
                          <TableRow key={adiant.id}>
                            <TableCell className="font-medium">{adiant.employees.nome_completo}</TableCell>
                            <TableCell>{adiant.employees.cargo}</TableCell>
                            <TableCell>{adiant.employees.setor || "-"}</TableCell>
                            <TableCell>{adiant.empresas.nome}</TableCell>
                            <TableCell className="font-semibold">R$ {adiant.valor.toFixed(2)}</TableCell>
                            <TableCell>
                              {getFormaPagamentoLabel(adiant.forma_pagamento)}
                            </TableCell>
                            <TableCell>
                              {adiant.status === "feito" ? (
                                <Badge className="bg-green-500 hover:bg-green-600">Feito</Badge>
                              ) : (
                                <Badge variant="outline" className="border-amber-500 text-amber-600">Aguardando</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {dataBR(adiant.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {adiant.status === "aguardando" && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="text-green-600 hover:text-green-700"
                                    title="Confirmar"
                                    onClick={() => handleConfirmAdiantamento(adiant.id)}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleOpenEdit(adiant)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Tem certeza que deseja excluir este adiantamento de {adiant.employees.nome_completo}?
                                        Esta ação não pode ser desfeita.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteAdiantamento(adiant.id)}>
                                        Excluir
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {historico.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                      <span className="text-lg font-semibold">Total Geral:</span>
                      <span className="text-2xl font-bold text-primary">
                        R$ {historico.reduce((sum, a) => sum + a.valor, 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {FORMAS_PAGAMENTO.map(f => (
                        <div key={f.value} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm font-medium">Total {f.label}:</span>
                          <span className="font-semibold">
                            R$ {historico.filter(a => a.forma_pagamento === f.value).reduce((sum, a) => sum + a.valor, 0).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Edição */}
      <Dialog open={!!editingAdiantamento} onOpenChange={(open) => !open && setEditingAdiantamento(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Adiantamento</DialogTitle>
          </DialogHeader>
          {editingAdiantamento && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-muted-foreground">Funcionário</Label>
                <p className="font-medium">{editingAdiantamento.employees.nome_completo}</p>
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingValor}
                  onChange={(e) => setEditingValor(e.target.value)}
                />
              </div>
              <div>
                <Label>Forma de Pagamento</Label>
                <Select value={editingFormaPagamento} onValueChange={(v) => setEditingFormaPagamento(v as FormaPagamento)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAdiantamento(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Adiantamentos;
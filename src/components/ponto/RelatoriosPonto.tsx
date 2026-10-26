import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Download, FileText, Users, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generatePontoPDF, generatePontoPDFBatch } from "@/lib/pdfGeneratorPonto";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { dataBR } from "@/lib/date";

const TIPO_DIA_LABELS: Record<string, string> = {
  normal: "Normal",
  abonado: "Abonado",
  falta: "Falta",
  ferias: "Férias",
  atestado: "Atestado",
};

type RegistroPontoRow = {
  tipo_dia: string;
  hora_entrada: string | null;
  hora_saida: string | null;
  hora_inicio_intervalo: string | null;
  hora_fim_intervalo: string | null;
  horas_trabalhadas: number | null;
};

function isDiaLancado(reg: Partial<RegistroPontoRow>) {
  return Boolean(
    reg.hora_entrada ||
      reg.hora_saida ||
      reg.hora_inicio_intervalo ||
      reg.hora_fim_intervalo ||
      (typeof reg.horas_trabalhadas === "number" && reg.horas_trabalhadas > 0)
  );
}

function isDiaNormalLancado(reg: Partial<RegistroPontoRow>) {
  return reg.tipo_dia === "normal" && isDiaLancado(reg);
}

function formatDecimalToHoursMinutes(decimal: number): string {
  const isNegative = decimal < 0;
  const absDecimal = Math.abs(decimal);
  const hours = Math.floor(absDecimal);
  const minutes = Math.round((absDecimal - hours) * 60);
  const sign = isNegative ? "-" : "";
  return `${sign}${hours}h${minutes.toString().padStart(2, '0')}min`;
}

export function RelatoriosPonto() {
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [exporting, setExporting] = useState(false);
  const [saldoMonth, setSaldoMonth] = useState(format(new Date(), "yyyy-MM"));
  const [filterSetor, setFilterSetor] = useState("all");
  
  // Filtros para exportação em lote
  const [batchMonth, setBatchMonth] = useState(format(new Date(), "yyyy-MM"));
  const [batchSetor, setBatchSetor] = useState("all");
  const [batchEmpresa, setBatchEmpresa] = useState("all");
  const [batchTipoContrato, setBatchTipoContrato] = useState("all");
  const [exportingBatch, setExportingBatch] = useState(false);

  const { data: setores } = useQuery({
    queryKey: ["setores-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setores")
        .select("id, nome")
        .order("nome");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: empresas } = useQuery({
    queryKey: ["empresas-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, logo_url")
        .order("nome");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: employees, isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees-for-relatorio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome_completo, cargo, setor, empresa_id, tipo_contrato")
        .order("nome_completo");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: report, isLoading: loadingReport } = useQuery({
    queryKey: ["relatorio-ponto", selectedEmployee, selectedMonth],
    queryFn: async () => {
      if (!selectedEmployee || !selectedMonth) return null;
      
      const [year, month] = selectedMonth.split("-");
      const startDate = format(startOfMonth(new Date(parseInt(year), parseInt(month) - 1)), "yyyy-MM-dd");
      const endDate = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), "yyyy-MM-dd");
      
      const { data: registros, error: regError } = await supabase
        .from("registros_ponto")
        .select("*")
        .eq("employee_id", selectedEmployee)
        .gte("data", startDate)
        .lte("data", endDate)
        .order("data");
      
      if (regError) throw regError;

      const { data: employeeData, error: empError } = await supabase
        .from("employees")
        .select("nome_completo, cargo, setor, empresa_id")
        .eq("id", selectedEmployee)
        .single();
      
      if (empError) throw empError;

      const { data: config, error: configError } = await supabase
        .from("configuracao_horas_trabalho")
        .select("horas_diarias_esperadas, hora_entrada_prevista, hora_saida_prevista")
        .eq("employee_id", selectedEmployee)
        .maybeSingle();
      
      if (configError) throw configError;

      let empresa = null;
      if (employeeData.empresa_id) {
        const { data: empresaData } = await supabase
          .from("empresas")
          .select("nome, logo_url")
          .eq("id", employeeData.empresa_id)
          .single();
        empresa = empresaData;
      }

      const horasDiarias = config?.horas_diarias_esperadas || 8.00;
      // Calcular somente dias "normal" que possuem lançamento de horários
      const diasLancadosNormais = registros.filter(isDiaNormalLancado).length;
      const horasEsperadas = diasLancadosNormais * horasDiarias;
      const horasTrabalhadas = registros.reduce((sum, r) => sum + (r.horas_trabalhadas || 0), 0);
      const saldo = horasTrabalhadas - horasEsperadas;

      return {
        registros,
        horasEsperadas,
        horasTrabalhadas,
        saldo,
        horasDiarias,
        horaEntradaPrevista: config?.hora_entrada_prevista || "08:00:00",
        horaSaidaPrevista: config?.hora_saida_prevista || "17:00:00",
        employee: employeeData,
        empresa,
      };
    },
    enabled: !!selectedEmployee && !!selectedMonth,
  });

  const { data: allSaldos, isLoading: loadingSaldos } = useQuery({
    queryKey: ["saldos-todos", saldoMonth, filterSetor],
    queryFn: async () => {
      if (!saldoMonth) return [];
      
      const [year, month] = saldoMonth.split("-");
      const startDate = format(startOfMonth(new Date(parseInt(year), parseInt(month) - 1)), "yyyy-MM-dd");
      const endDate = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), "yyyy-MM-dd");
      
      let query = supabase
        .from("employees")
        .select("id, nome_completo, cargo, setor")
        .in("status", ["ativo", "ferias"]);

      if (filterSetor && filterSetor !== "all") {
        query = query.eq("setor", filterSetor);
      }
      
      const { data: employees, error: empError } = await query.order("nome_completo");
      
      if (empError) throw empError;

      const saldos = await Promise.all(
        employees.map(async (emp) => {
          const { data: registros } = await supabase
            .from("registros_ponto")
            .select("*")
            .eq("employee_id", emp.id)
            .gte("data", startDate)
            .lte("data", endDate);

          const { data: config } = await supabase
            .from("configuracao_horas_trabalho")
            .select("*")
            .eq("employee_id", emp.id)
            .maybeSingle();

          const horasDiarias = config?.horas_diarias_esperadas || 8.00;
          // Calcular somente dias "normal" que possuem lançamento de horários
          const diasLancadosNormais = registros?.filter(isDiaNormalLancado).length || 0;
          const horasEsperadas = diasLancadosNormais * horasDiarias;
          const horasTrabalhadas = registros?.reduce((sum, r) => sum + (r.horas_trabalhadas || 0), 0) || 0;
          const saldo = horasTrabalhadas - horasEsperadas;

          return {
            id: emp.id,
            nome: emp.nome_completo,
            cargo: emp.cargo,
            setor: emp.setor || "-",
            horasEsperadas,
            horasTrabalhadas,
            saldo,
          };
        })
      );

      return saldos;
    },
    enabled: !!saldoMonth,
  });

  const getSaldoBadge = (saldo: number) => {
    if (saldo > 0) {
      return <Badge variant="default" className="bg-green-500">+{formatDecimalToHoursMinutes(saldo)}</Badge>;
    } else if (saldo < 0) {
      return <Badge variant="destructive">{formatDecimalToHoursMinutes(saldo)}</Badge>;
    } else {
      return <Badge variant="secondary">0h00min</Badge>;
    }
  };

  const handleExportPDF = async () => {
    if (!report || !report.employee) return;
    
    setExporting(true);
    try {
      const [year, month] = selectedMonth.split("-");
      const mesFormatado = format(new Date(parseInt(year), parseInt(month) - 1), "MMMM 'de' yyyy", { locale: ptBR });
      
      await generatePontoPDF({
        employee: report.employee,
        mes: mesFormatado,
        registros: report.registros,
        horasEsperadas: report.horasEsperadas,
        horasTrabalhadas: report.horasTrabalhadas,
        saldo: report.saldo,
        horasDiarias: report.horasDiarias,
        horaEntradaPrevista: report.horaEntradaPrevista,
        horaSaidaPrevista: report.horaSaidaPrevista,
        empresa: report.empresa || undefined,
      });
      
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    } finally {
      setExporting(false);
    }
  };

  const handleExportSaldoGeralPDF = async () => {
    if (!allSaldos || allSaldos.length === 0) return;
    
    setExporting(true);
    try {
      const doc = new jsPDF();
      const [year, month] = saldoMonth.split("-");
      const mesFormatado = format(new Date(parseInt(year), parseInt(month) - 1), "MMMM 'de' yyyy", { locale: ptBR });

      doc.setFontSize(16);
      doc.text("RELATÓRIO GERAL DE SALDO DE HORAS", 105, 15, { align: "center" });
      
      doc.setFontSize(11);
      doc.text(`Período: ${mesFormatado}`, 105, 22, { align: "center" });
      if (filterSetor && filterSetor !== "all") {
        const setorNome = setores?.find(s => s.nome === filterSetor)?.nome || filterSetor;
        doc.text(`Setor: ${setorNome}`, 105, 28, { align: "center" });
      }

      const tableData = allSaldos.map((item) => [
        item.nome,
        item.setor,
        `${item.saldo >= 0 ? "+" : ""}${formatDecimalToHoursMinutes(item.saldo)}`,
      ]);

      autoTable(doc, {
        startY: filterSetor && filterSetor !== "all" ? 33 : 27,
        head: [["Funcionário", "Setor", "Saldo"]],
        body: tableData,
        theme: "grid",
        styles: { fontSize: 9 },
        headStyles: { fillColor: [66, 66, 66] },
      });

      // Cálculo de totais
      const totalSaldo = allSaldos.reduce((sum, item) => sum + item.saldo, 0);

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.text(`Saldo Total: ${totalSaldo >= 0 ? "+" : ""}${formatDecimalToHoursMinutes(totalSaldo)}`, 14, finalY);

      doc.save(`Saldo_Geral_${mesFormatado.replace(/ /g, "_")}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    } finally {
      setExporting(false);
    }
  };

  const handleExportSaldoGeralExcel = async () => {
    if (!allSaldos || allSaldos.length === 0) return;
    
    setExporting(true);
    try {
      const [year, month] = saldoMonth.split("-");
      const mesFormatado = format(new Date(parseInt(year), parseInt(month) - 1), "MMMM 'de' yyyy", { locale: ptBR });
      
      const header = [
        ["RELATÓRIO GERAL DE SALDO DE HORAS"],
        [`Período: ${mesFormatado}`],
        filterSetor && filterSetor !== "all" ? [`Setor: ${setores?.find(s => s.nome === filterSetor)?.nome || filterSetor}`] : [],
        [],
      ].filter(row => row.length > 0);

      const tableHeader = [["Funcionário", "Setor", "Saldo"]];
      
      const tableData = allSaldos.map((item) => [
        item.nome,
        item.setor,
        `${item.saldo >= 0 ? "+" : ""}${formatDecimalToHoursMinutes(item.saldo)}`,
      ]);

      const totalSaldo = allSaldos.reduce((sum, item) => sum + item.saldo, 0);

      const resumo = [
        [],
        ["TOTAIS"],
        [`Saldo Total: ${totalSaldo >= 0 ? "+" : ""}${formatDecimalToHoursMinutes(totalSaldo)}`],
      ];

      const wsData = [...header, ...tableHeader, ...tableData, ...resumo];
      
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Saldo Geral");
      
      XLSX.writeFile(wb, `Saldo_Geral_${mesFormatado.replace(/ /g, "_")}.xlsx`);
      toast.success("Excel gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar Excel:", error);
      toast.error("Erro ao gerar Excel");
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!report || !report.employee) return;
    
    setExporting(true);
    try {
      const [year, month] = selectedMonth.split("-");
      const mesFormatado = format(new Date(parseInt(year), parseInt(month) - 1), "MMMM 'de' yyyy", { locale: ptBR });
      
      // Cabeçalho
      const header = [
        ["RELATÓRIO DE PONTO"],
        [`Período: ${mesFormatado}`],
        [],
        ["DADOS DO FUNCIONÁRIO"],
        [`Nome: ${report.employee.nome_completo}`],
        [`Cargo: ${report.employee.cargo}`],
        [`Setor: ${report.employee.setor || "-"}`],
        [`Horas Diárias Esperadas: ${formatDecimalToHoursMinutes(report.horasDiarias)}`],
        [],
      ];

      // Dados da tabela
      const tableHeader = [["Data", "Tipo", "Entrada", "Saída", "Início Intervalo", "Fim Intervalo", "Horas", "Observações"]];
      
      const tableData = report.registros.map((reg) => {
        const dataFormatada = format(dataBR(reg.data + "T00:00:00"), "dd/MM/yyyy (EEE)", { locale: ptBR });
        return [
          dataFormatada,
          TIPO_DIA_LABELS[reg.tipo_dia] || reg.tipo_dia,
          reg.hora_entrada || "-",
          reg.hora_saida || "-",
          reg.hora_inicio_intervalo || "-",
          reg.hora_fim_intervalo || "-",
          reg.horas_trabalhadas ? formatDecimalToHoursMinutes(reg.horas_trabalhadas) : "0h00min",
          reg.observacoes || "-",
        ];
      });

      // Resumo
      const resumo = [
        [],
        ["RESUMO DO PERÍODO"],
        [`Horas Esperadas: ${formatDecimalToHoursMinutes(report.horasEsperadas)}`],
        [`Horas Trabalhadas: ${formatDecimalToHoursMinutes(report.horasTrabalhadas)}`],
        [`Saldo: ${report.saldo >= 0 ? "+" : ""}${formatDecimalToHoursMinutes(report.saldo)}`],
      ];

      // Combinar tudo
      const wsData = [...header, ...tableHeader, ...tableData, ...resumo];
      
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Larguras das colunas
      ws["!cols"] = [
        { wch: 20 }, // Data
        { wch: 15 }, // Tipo
        { wch: 10 }, // Entrada
        { wch: 10 }, // Saída
        { wch: 15 }, // Início Intervalo
        { wch: 15 }, // Fim Intervalo
        { wch: 10 }, // Horas
        { wch: 30 }, // Observações
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Relatório de Ponto");
      
      const fileName = `relatorio_ponto_${report.employee.nome_completo.replace(/\s+/g, "_")}_${selectedMonth.replace("/", "-")}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.success("Excel gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar Excel:", error);
      toast.error("Erro ao gerar Excel");
    } finally {
      setExporting(false);
    }
  };

  const handleExportAllIndividualPDFs = async () => {
    if (!employees || employees.length === 0) return;
    
    setExportingBatch(true);
    try {
      const [year, month] = batchMonth.split("-");
      const startDate = format(startOfMonth(new Date(parseInt(year), parseInt(month) - 1)), "yyyy-MM-dd");
      const endDate = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), "yyyy-MM-dd");
      const mesFormatado = format(new Date(parseInt(year), parseInt(month) - 1), "MMMM 'de' yyyy", { locale: ptBR });
      
      // Filtrar funcionários
      let filteredEmployees = employees.filter(emp => emp.tipo_contrato); // apenas com tipo_contrato
      
      if (batchSetor !== "all") {
        filteredEmployees = filteredEmployees.filter(emp => emp.setor === batchSetor);
      }
      if (batchEmpresa !== "all") {
        filteredEmployees = filteredEmployees.filter(emp => emp.empresa_id === batchEmpresa);
      }
      if (batchTipoContrato !== "all") {
        filteredEmployees = filteredEmployees.filter(emp => emp.tipo_contrato === batchTipoContrato);
      }

      // Incluir todos os funcionários ativos se não houver filtro de tipo_contrato
      if (batchSetor === "all" && batchEmpresa === "all" && batchTipoContrato === "all") {
        filteredEmployees = employees;
      }

      if (filteredEmployees.length === 0) {
        toast.error("Nenhum funcionário encontrado com os filtros selecionados");
        return;
      }

      toast.info(`Coletando dados de ${filteredEmployees.length} funcionários...`);

      const reportsData = [];

      for (const emp of filteredEmployees) {
        // Buscar registros do funcionário
        const { data: registros } = await supabase
          .from("registros_ponto")
          .select("*")
          .eq("employee_id", emp.id)
          .gte("data", startDate)
          .lte("data", endDate)
          .order("data");

        // Buscar configuração de horas
        const { data: config } = await supabase
          .from("configuracao_horas_trabalho")
          .select("horas_diarias_esperadas, hora_entrada_prevista, hora_saida_prevista")
          .eq("employee_id", emp.id)
          .maybeSingle();

        // Buscar empresa
        let empresa = null;
        if (emp.empresa_id) {
          const { data: empresaData } = await supabase
            .from("empresas")
            .select("nome, logo_url")
            .eq("id", emp.empresa_id)
            .single();
          empresa = empresaData;
        }

        const horasDiarias = config?.horas_diarias_esperadas || 8.00;
        // Calcular somente dias "normal" que possuem lançamento de horários
        const diasLancadosNormais = registros?.filter(isDiaNormalLancado).length || 0;
        const horasEsperadas = diasLancadosNormais * horasDiarias;
        const horasTrabalhadas = registros?.reduce((sum, r) => sum + (r.horas_trabalhadas || 0), 0) || 0;
        const saldo = horasTrabalhadas - horasEsperadas;

        reportsData.push({
          employee: {
            nome_completo: emp.nome_completo,
            cargo: emp.cargo,
            setor: emp.setor,
          },
          mes: mesFormatado,
          registros: registros || [],
          horasEsperadas,
          horasTrabalhadas,
          saldo,
          horasDiarias,
          horaEntradaPrevista: config?.hora_entrada_prevista || "08:00:00",
          horaSaidaPrevista: config?.hora_saida_prevista || "17:00:00",
          empresa: empresa || undefined,
        });
      }

      // Gerar PDF único com todos os relatórios
      await generatePontoPDFBatch(reportsData, mesFormatado);
      
      toast.success(`Relatório com ${filteredEmployees.length} funcionários gerado com sucesso!`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    } finally {
      setExportingBatch(false);
    }
  };

  const tiposContrato = ["fixo", "intermitente", "prestador_servico"];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-4">Relatórios de Ponto</h2>
        <p className="text-muted-foreground">
          Visualize relatórios detalhados e saldo de horas dos funcionários
        </p>
      </div>

      <Tabs defaultValue="individual" className="w-full">
        <TabsList>
          <TabsTrigger value="individual">Relatório Individual</TabsTrigger>
          <TabsTrigger value="todos">Saldo de Todos</TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="employee-relatorio">Funcionário *</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {loadingEmployees ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : (
                    employees?.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nome_completo} - {emp.cargo}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="month-relatorio">Mês *</Label>
              <Input
                id="month-relatorio"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
          </div>

          {loadingReport && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {report && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="p-4 border rounded-lg bg-card">
                  <div className="text-sm text-muted-foreground">Horas Esperadas</div>
                  <div className="text-2xl font-bold">{formatDecimalToHoursMinutes(report.horasEsperadas)}</div>
                </div>
                <div className="p-4 border rounded-lg bg-card">
                  <div className="text-sm text-muted-foreground">Horas Trabalhadas</div>
                  <div className="text-2xl font-bold">{formatDecimalToHoursMinutes(report.horasTrabalhadas)}</div>
                </div>
                <div className="p-4 border rounded-lg bg-card">
                  <div className="text-sm text-muted-foreground">Saldo de Horas</div>
                  <div className="text-2xl font-bold">{getSaldoBadge(report.saldo)}</div>
                </div>
                <div className="p-4 border rounded-lg bg-card">
                  <div className="text-sm text-muted-foreground">Horas/Dia Esperadas</div>
                  <div className="text-2xl font-bold">{formatDecimalToHoursMinutes(report.horasDiarias)}</div>
                </div>
              </div>

              <div className="border rounded-lg overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead>Intervalo</TableHead>
                      <TableHead>Horas</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.registros.map((reg) => (
                      <TableRow key={reg.id}>
                        <TableCell className="font-medium">
                          {format(dataBR(reg.data + "T00:00:00"), "dd/MM/yyyy (EEE)", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={reg.tipo_dia === "falta" ? "destructive" : "secondary"}>
                            {TIPO_DIA_LABELS[reg.tipo_dia]}
                          </Badge>
                        </TableCell>
                        <TableCell>{reg.hora_entrada || "-"}</TableCell>
                        <TableCell>{reg.hora_saida || "-"}</TableCell>
                        <TableCell>
                          {reg.hora_inicio_intervalo && reg.hora_fim_intervalo
                            ? `${reg.hora_inicio_intervalo} - ${reg.hora_fim_intervalo}`
                            : "-"}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {reg.horas_trabalhadas ? formatDecimalToHoursMinutes(reg.horas_trabalhadas) : "0h00min"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {reg.observacoes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportExcel}
                  disabled={exporting}
                >
                  {exporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Exportar Excel
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportPDF}
                  disabled={exporting}
                >
                  {exporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Exportar PDF
                </Button>
              </div>
            </>
          )}

          {/* Exportação em Lote */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Exportar Relatórios de Todos
              </CardTitle>
              <CardDescription>
                Gere relatórios individuais de ponto para múltiplos funcionários de uma só vez
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Mês</Label>
                  <Input
                    type="month"
                    value={batchMonth}
                    onChange={(e) => setBatchMonth(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Select value={batchEmpresa} onValueChange={setBatchEmpresa}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {empresas?.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Setor</Label>
                  <Select value={batchSetor} onValueChange={setBatchSetor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {setores?.map((setor) => (
                        <SelectItem key={setor.id} value={setor.nome}>
                          {setor.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Contrato</Label>
                  <Select value={batchTipoContrato} onValueChange={setBatchTipoContrato}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {tiposContrato.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {tipo === "fixo" ? "Fixo" : tipo === "intermitente" ? "Intermitente" : "Prestador de Serviço"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleExportAllIndividualPDFs}
                  disabled={exportingBatch}
                >
                  {exportingBatch ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Exportar Todos os PDFs
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="todos" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="saldo-month">Selecione o Mês</Label>
              <Input
                id="saldo-month"
                type="month"
                value={saldoMonth}
                onChange={(e) => setSaldoMonth(e.target.value)}
                className="max-w-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-setor-saldo">Filtrar por Setor</Label>
              <Select value={filterSetor} onValueChange={setFilterSetor}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Todos os setores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {setores?.map((setor) => (
                    <SelectItem key={setor.id} value={setor.nome}>
                      {setor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loadingSaldos && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {allSaldos && allSaldos.length > 0 && (
            <>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Saldo Positivo
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {allSaldos.filter(item => item.saldo > 0).length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      funcionários com horas extras
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Saldo Negativo
                    </CardTitle>
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {allSaldos.filter(item => item.saldo < 0).length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      funcionários devendo horas
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Saldo Zerado
                    </CardTitle>
                    <Minus className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {allSaldos.filter(item => item.saldo === 0).length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      funcionários em dia
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allSaldos.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.nome}</TableCell>
                        <TableCell>{item.setor}</TableCell>
                        <TableCell 
                          className={`font-semibold ${
                            item.saldo > 0 
                              ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20' 
                              : item.saldo < 0 
                              ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {item.saldo > 0 ? '+' : ''}{formatDecimalToHoursMinutes(item.saldo)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportSaldoGeralExcel}
                  disabled={exporting}
                >
                  {exporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Exportar Excel
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportSaldoGeralPDF}
                  disabled={exporting}
                >
                  {exporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Exportar PDF
                </Button>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

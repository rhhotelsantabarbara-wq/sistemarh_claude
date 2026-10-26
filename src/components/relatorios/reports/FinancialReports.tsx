import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import ExportButtons from "../ExportButtons";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { dataBR } from "@/lib/date";

const FinancialReports = () => {
  const [reportType, setReportType] = useState("payroll");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: payroll, isLoading: loadingPayroll } = useQuery({
    queryKey: ["payroll-report", selectedMonth, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folha_pagamento")
        .select("*, employees(nome_completo, cargo, tipo_contrato), empresas(nome), folha_pagamento_itens(id, variavel_id, valor, variaveis_folha(id, nome, tipo, codigo))")
        .eq("mes", selectedMonth)
        .eq("ano", selectedYear);
      if (error) throw error;
      return data;
    },
    enabled: reportType === "payroll",
  });

  const { data: salaryHistory, isLoading: loadingSalaryHistory } = useQuery({
    queryKey: ["salary-history-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_reajustes_salariais")
        .select("*, employees(nome_completo, cargo)")
        .order("aplicado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: reportType === "salary-history",
  });

  const exportToPDF = () => {
    const doc = new jsPDF();
    const title = reportType === "payroll"
      ? `Folha ${selectedMonth}/${selectedYear}`
      : "Histórico Salarial";

    doc.setFontSize(14);
    doc.text(title, 14, 15);
    doc.setFontSize(9);
    doc.text(new Date().toLocaleDateString(), 14, 22);

    if (reportType === "payroll") {
      const totalB = payroll?.reduce((sum, p) => sum + Number(p.valor_bruto), 0) || 0;
      const totalC = payroll?.reduce((sum, p) => sum + calcularValorEmConta(p), 0) || 0;
      const totalM = totalB - totalC;
      doc.text(`Total: R$ ${totalB.toFixed(2)} | Em Conta: R$ ${totalC.toFixed(2)} | Em Mãos: R$ ${totalM.toFixed(2)}`, 14, 28);

      let yPos = 36;
      payroll?.forEach((item, i) => {
        if (yPos > 280) {
          doc.addPage();
          yPos = 15;
        }
        doc.text(`${i + 1}. ${item.employees?.nome_completo} | R$ ${Number(item.valor_liquido).toFixed(2)}`, 14, yPos);
        yPos += 6;
      });
    } else {
      let yPos = 30;
      salaryHistory?.forEach((item, i) => {
        if (yPos > 280) {
          doc.addPage();
          yPos = 15;
        }
        doc.text(`${i + 1}. ${item.employees?.nome_completo} | R$ ${Number(item.salario_anterior).toFixed(2)} → R$ ${Number(item.salario_novo).toFixed(2)}`, 14, yPos);
        yPos += 6;
      });
    }

    doc.save(`financeiro-${new Date().getTime()}.pdf`);
  };

  const exportToExcel = () => {
    let data: any[] = [];
    let sheetName = "";

    if (reportType === "payroll") {
      sheetName = "Folha de Pagamento";
      data =
        payroll?.map((item) => ({
          Funcionário: item.employees?.nome_completo,
          Cargo: item.employees?.cargo,
          Empresa: item.empresas?.nome,
          "Tipo Contrato": item.employees?.tipo_contrato,
          "Valor Bruto": Number(item.valor_bruto),
          Descontos: Number(item.descontos),
          "Valor Líquido": Number(item.valor_liquido),
          Mês: item.mes,
          Ano: item.ano,
        })) || [];
    } else {
      sheetName = "Histórico Salarial";
      data =
        salaryHistory?.map((item) => ({
          Funcionário: item.employees?.nome_completo,
          Cargo: item.employees?.cargo,
          "Salário Anterior": Number(item.salario_anterior),
          "Salário Novo": Number(item.salario_novo),
          "Percentual Reajuste": item.percentual_reajuste,
          Justificativa: item.justificativa,
          Data: dataBR(item.aplicado_em).toLocaleDateString(),
        })) || [];
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `relatorio-financeiro-${new Date().getTime()}.xlsx`);
  };

  const isLoading = loadingPayroll || loadingSalaryHistory;
  const currentData = reportType === "payroll" ? payroll : salaryHistory;

  const paginatedData = useMemo(() => {
    if (!currentData) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return currentData.slice(startIndex, endIndex);
  }, [currentData, currentPage]);

  const totalPages = Math.ceil((currentData?.length || 0) / itemsPerPage);
  // Função helper para calcular valor em conta de um pagamento
  const calcularValorEmConta = (p: any) => {
    const itens = p.folha_pagamento_itens || [];
    const itemEmConta = itens.find((i: any) => 
      i.variaveis_folha?.nome?.toLowerCase().includes("valor em conta") ||
      i.variaveis_folha?.codigo === "3503"
    );
    return itemEmConta?.valor || 0;
  };

  const totalBruto = payroll?.reduce((sum, p) => sum + Number(p.valor_bruto), 0) || 0;
  const totalEmConta = payroll?.reduce((sum, p) => sum + calcularValorEmConta(p), 0) || 0;
  // Total em Mãos = Valor Bruto - Valor em Conta
  const totalEmMaos = totalBruto - totalEmConta;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Relatório</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Relatório</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="payroll">Folha de Pagamento</SelectItem>
                  <SelectItem value="salary-history">Histórico Salarial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reportType === "payroll" && (
              <>
                <div className="space-y-2">
                  <Label>Mês</Label>
                  <Select
                    value={selectedMonth.toString()}
                    onValueChange={(v) => setSelectedMonth(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {new Date(2024, i).toLocaleDateString("pt-BR", { month: "long" })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Select
                    value={selectedYear.toString()}
                    onValueChange={(v) => setSelectedYear(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = new Date().getFullYear() - 2 + i;
                        return (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end">
            <ExportButtons
              onExportPDF={exportToPDF}
              onExportExcel={exportToExcel}
              disabled={!currentData || currentData.length === 0}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {reportType === "payroll"
              ? `Folha de Pagamento - ${selectedMonth}/${selectedYear}`
              : "Histórico de Reajustes Salariais"}
          </CardTitle>
          {reportType === "payroll" && (
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span><strong>Total:</strong> R$ {totalBruto.toFixed(2)}</span>
              <span><strong>Total em Conta:</strong> R$ {totalEmConta.toFixed(2)}</span>
              <span><strong>Total em Mãos:</strong> R$ {totalEmMaos.toFixed(2)}</span>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {currentData?.length || 0} registros | Página {currentPage} de {totalPages}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : currentData && currentData.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-2">Funcionário</TableHead>
                      <TableHead className="py-2">Cargo</TableHead>
                      {reportType === "payroll" ? (
                        <>
                          <TableHead className="py-2">Empresa</TableHead>
                          <TableHead className="py-2">Valor Bruto</TableHead>
                          <TableHead className="py-2">Valor Líquido</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead className="py-2">Anterior</TableHead>
                          <TableHead className="py-2">Novo</TableHead>
                          <TableHead className="py-2">Reajuste %</TableHead>
                          <TableHead className="py-2">Justificativa</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="py-2 font-medium">
                          {item.employees?.nome_completo}
                        </TableCell>
                        <TableCell className="py-2">{item.employees?.cargo}</TableCell>
                        {reportType === "payroll" ? (
                          <>
                            <TableCell className="py-2">{item.empresas?.nome}</TableCell>
                            <TableCell className="py-2">R$ {Number(item.valor_bruto).toFixed(2)}</TableCell>
                            <TableCell className="py-2">R$ {Number(item.valor_liquido).toFixed(2)}</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="py-2">R$ {Number(item.salario_anterior).toFixed(2)}</TableCell>
                            <TableCell className="py-2">R$ {Number(item.salario_novo).toFixed(2)}</TableCell>
                            <TableCell className="py-2">{item.percentual_reajuste}%</TableCell>
                            <TableCell className="py-2">{item.justificativa}</TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhum registro encontrado
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialReports;

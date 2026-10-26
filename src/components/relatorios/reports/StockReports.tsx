import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import ExportButtons from "../ExportButtons";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { dataBR } from "@/lib/date";

const StockReports = () => {
  const [reportType, setReportType] = useState("epi-stock");

  const { data: epiStock, isLoading: loadingEpiStock } = useQuery({
    queryKey: ["epi-stock-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_epis")
        .select("*")
        .order("tipo_epi");
      if (error) throw error;
      return data;
    },
    enabled: reportType === "epi-stock",
  });

  const { data: uniformStock, isLoading: loadingUniformStock } = useQuery({
    queryKey: ["uniform-stock-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_uniformes")
        .select("*")
        .order("tipo_uniforme");
      if (error) throw error;
      return data;
    },
    enabled: reportType === "uniform-stock",
  });

  const { data: epiDistributions, isLoading: loadingEpiDist } = useQuery({
    queryKey: ["epi-distributions-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("epis")
        .select("*, employees(nome_completo, cargo)")
        .order("data_entrega", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: reportType === "epi-distributions",
  });

  const { data: uniformDistributions, isLoading: loadingUniformDist } = useQuery({
    queryKey: ["uniform-distributions-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uniformes")
        .select("*, employees(nome_completo, cargo)")
        .order("data_entrega", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: reportType === "uniform-distributions",
  });

  const exportToPDF = () => {
    const doc = new jsPDF();
    let title = "";
    let data: any[] = [];

    switch (reportType) {
      case "epi-stock":
        title = "Relatório de Estoque de EPIs";
        data = epiStock || [];
        break;
      case "uniform-stock":
        title = "Relatório de Estoque de Uniformes";
        data = uniformStock || [];
        break;
      case "epi-distributions":
        title = "Relatório de Distribuição de EPIs";
        data = epiDistributions || [];
        break;
      case "uniform-distributions":
        title = "Relatório de Distribuição de Uniformes";
        data = uniformDistributions || [];
        break;
    }

    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Total: ${data.length} registros`, 14, 36);

    let yPos = 46;
    data.forEach((item, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      if (reportType === "epi-stock" || reportType === "uniform-stock") {
        const itemName = reportType === "epi-stock" ? item.tipo_epi : item.tipo_uniforme;
        doc.text(`${index + 1}. ${itemName}`, 14, yPos);
        doc.text(`Quantidade: ${item.quantidade_estoque}`, 20, yPos + 6);
        doc.text(`Estoque Mínimo: ${item.quantidade_minima}`, 20, yPos + 12);
        if (item.tamanho) doc.text(`Tamanho: ${item.tamanho}`, 20, yPos + 18);
        yPos += 26;
      } else {
        const itemName = reportType === "epi-distributions" ? item.tipo_epi : item.tipo_uniforme;
        doc.text(`${index + 1}. ${item.employees?.nome_completo}`, 14, yPos);
        doc.text(`${itemName} - Qtd: ${item.quantidade}`, 20, yPos + 6);
        doc.text(`Data: ${format(dataBR(item.data_entrega), "dd/MM/yyyy")}`, 20, yPos + 12);
        yPos += 20;
      }
    });

    doc.save(`relatorio-estoque-${new Date().getTime()}.pdf`);
  };

  const exportToExcel = () => {
    let data: any[] = [];
    let sheetName = "";

    switch (reportType) {
      case "epi-stock":
        sheetName = "Estoque EPIs";
        data =
          epiStock?.map((item) => ({
            "Tipo EPI": item.tipo_epi,
            Quantidade: item.quantidade_estoque,
            "Qtd Mínima": item.quantidade_minima,
            Tamanho: item.tamanho || "-",
            "Marca/Modelo": item.marca_modelo || "-",
            CA: item.ca || "-",
          })) || [];
        break;
      case "uniform-stock":
        sheetName = "Estoque Uniformes";
        data =
          uniformStock?.map((item) => ({
            "Tipo Uniforme": item.tipo_uniforme,
            Quantidade: item.quantidade_estoque,
            "Qtd Mínima": item.quantidade_minima,
            Tamanho: item.tamanho,
            Cor: item.cor || "-",
          })) || [];
        break;
      case "epi-distributions":
        sheetName = "Distribuições EPIs";
        data =
          epiDistributions?.map((item) => ({
            Funcionário: item.employees?.nome_completo,
            "Tipo EPI": item.tipo_epi,
            Quantidade: item.quantidade,
            "Data Entrega": format(dataBR(item.data_entrega), "dd/MM/yyyy"),
            Assinado: item.assinatura_funcionario ? "Sim" : "Não",
          })) || [];
        break;
      case "uniform-distributions":
        sheetName = "Distribuições Uniformes";
        data =
          uniformDistributions?.map((item) => ({
            Funcionário: item.employees?.nome_completo,
            "Tipo Uniforme": item.tipo_uniforme,
            Tamanho: item.tamanho,
            Quantidade: item.quantidade,
            "Data Entrega": format(dataBR(item.data_entrega), "dd/MM/yyyy"),
            Assinado: item.assinatura_funcionario ? "Sim" : "Não",
          })) || [];
        break;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `relatorio-estoque-${new Date().getTime()}.xlsx`);
  };

  const isLoading = loadingEpiStock || loadingUniformStock || loadingEpiDist || loadingUniformDist;
  const currentData =
    reportType === "epi-stock"
      ? epiStock
      : reportType === "uniform-stock"
        ? uniformStock
        : reportType === "epi-distributions"
          ? epiDistributions
          : uniformDistributions;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Relatório</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Relatório</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="epi-stock">Estoque de EPIs</SelectItem>
                  <SelectItem value="uniform-stock">Estoque de Uniformes</SelectItem>
                  <SelectItem value="epi-distributions">Distribuições de EPIs</SelectItem>
                  <SelectItem value="uniform-distributions">
                    Distribuições de Uniformes
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            {reportType === "epi-stock"
              ? "Estoque de EPIs"
              : reportType === "uniform-stock"
                ? "Estoque de Uniformes"
                : reportType === "epi-distributions"
                  ? "Distribuições de EPIs"
                  : "Distribuições de Uniformes"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Total: {currentData?.length || 0} registros
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : currentData && currentData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {(reportType === "epi-stock" || reportType === "uniform-stock") && (
                      <>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Qtd Mínima</TableHead>
                        <TableHead>Status</TableHead>
                      </>
                    )}
                    {(reportType === "epi-distributions" ||
                      reportType === "uniform-distributions") && (
                      <>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Data Entrega</TableHead>
                        <TableHead>Assinatura</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentData.map((item: any) => (
                    <TableRow key={item.id}>
                      {(reportType === "epi-stock" || reportType === "uniform-stock") && (
                        <>
                          <TableCell className="font-medium">
                            {reportType === "epi-stock" ? item.tipo_epi : item.tipo_uniforme}
                          </TableCell>
                          <TableCell>{item.quantidade_estoque}</TableCell>
                          <TableCell>{item.quantidade_minima}</TableCell>
                          <TableCell>
                            {item.quantidade_estoque <= item.quantidade_minima ? (
                              <Badge variant="destructive">Baixo</Badge>
                            ) : (
                              <Badge variant="default">OK</Badge>
                            )}
                          </TableCell>
                        </>
                      )}
                      {(reportType === "epi-distributions" ||
                        reportType === "uniform-distributions") && (
                        <>
                          <TableCell className="font-medium">
                            {item.employees?.nome_completo}
                          </TableCell>
                          <TableCell>
                            {reportType === "epi-distributions"
                              ? item.tipo_epi
                              : item.tipo_uniforme}
                          </TableCell>
                          <TableCell>{item.quantidade}</TableCell>
                          <TableCell>
                            {format(dataBR(item.data_entrega), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            {item.assinatura_funcionario ? (
                              <Badge variant="default">Assinado</Badge>
                            ) : (
                              <Badge variant="secondary">Pendente</Badge>
                            )}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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

export default StockReports;

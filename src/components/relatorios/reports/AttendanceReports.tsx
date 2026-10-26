import { useState } from "react";
import { parseDateOnly, dataBR } from "@/lib/date";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ExportButtons from "../ExportButtons";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

const AttendanceReports = () => {
  const [reportType, setReportType] = useState("absences");

  const { data: absences, isLoading: loadingAbsences } = useQuery({
    queryKey: ["absences-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("afastamentos")
        .select("*, employees(nome_completo, cargo)")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: reportType === "absences",
  });

  const { data: vacations, isLoading: loadingVacations } = useQuery({
    queryKey: ["vacations-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias")
        .select("*, employees(nome_completo, cargo)")
        .order("periodo_gozo_inicio", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: reportType === "vacations",
  });

  const { data: timeOff, isLoading: loadingTimeOff } = useQuery({
    queryKey: ["timeoff-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folgas")
        .select("*, employees(nome_completo, cargo)")
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: reportType === "timeoff",
  });

  const { data: faults, isLoading: loadingFaults } = useQuery({
    queryKey: ["faults-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faltas")
        .select("*, employees(nome_completo, cargo)")
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: reportType === "faults",
  });

  const exportToPDF = () => {
    const doc = new jsPDF();
    let title = "";
    let data: any[] = [];

    switch (reportType) {
      case "absences":
        title = "Relatório de Afastamentos";
        data = absences || [];
        break;
      case "vacations":
        title = "Relatório de Férias";
        data = vacations || [];
        break;
      case "timeoff":
        title = "Relatório de Folgas";
        data = timeOff || [];
        break;
      case "faults":
        title = "Relatório de Faltas";
        data = faults || [];
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

      doc.text(`${index + 1}. ${item.employees?.nome_completo}`, 14, yPos);
      doc.text(`Cargo: ${item.employees?.cargo}`, 20, yPos + 6);

      if (reportType === "absences") {
        doc.text(`Motivo: ${item.motivo}`, 20, yPos + 12);
        doc.text(
          `Período: ${format((parseDateOnly(item.data_inicio) ?? new Date()), "dd/MM/yyyy")} - ${format((parseDateOnly(item.data_fim) ?? new Date()), "dd/MM/yyyy")}`,
          20,
          yPos + 18
        );
      } else if (reportType === "vacations") {
        doc.text(
          `Gozo: ${format((parseDateOnly(item.periodo_gozo_inicio) ?? new Date()), "dd/MM/yyyy")} - ${format((parseDateOnly(item.periodo_gozo_fim) ?? new Date()), "dd/MM/yyyy")}`,
          20,
          yPos + 12
        );
        doc.text(`Dias: ${item.dias_totais}`, 20, yPos + 18);
      } else if (reportType === "timeoff") {
        doc.text(`Data: ${format(dataBR(item.data), "dd/MM/yyyy")}`, 20, yPos + 12);
        doc.text(`Motivo: ${item.motivo}`, 20, yPos + 18);
      } else if (reportType === "faults") {
        doc.text(`Data: ${format(dataBR(item.data), "dd/MM/yyyy")}`, 20, yPos + 12);
        doc.text(`Justificada: ${item.justificada ? "Sim" : "Não"}`, 20, yPos + 18);
      }

      yPos += 28;
    });

    doc.save(`relatorio-frequencia-${new Date().getTime()}.pdf`);
  };

  const exportToExcel = () => {
    let data: any[] = [];
    let sheetName = "";

    switch (reportType) {
      case "absences":
        sheetName = "Afastamentos";
        data =
          absences?.map((item) => ({
            Funcionário: item.employees?.nome_completo,
            Cargo: item.employees?.cargo,
            Motivo: item.motivo,
            "Data Início": format((parseDateOnly(item.data_inicio) ?? new Date()), "dd/MM/yyyy"),
            "Data Fim": format((parseDateOnly(item.data_fim) ?? new Date()), "dd/MM/yyyy"),
            CID: item.cid || "-",
          })) || [];
        break;
      case "vacations":
        sheetName = "Férias";
        data =
          vacations?.map((item) => ({
            Funcionário: item.employees?.nome_completo,
            Cargo: item.employees?.cargo,
            "Início Gozo": format((parseDateOnly(item.periodo_gozo_inicio) ?? new Date()), "dd/MM/yyyy"),
            "Fim Gozo": format((parseDateOnly(item.periodo_gozo_fim) ?? new Date()), "dd/MM/yyyy"),
            "Dias Totais": item.dias_totais,
            Confirmada: item.data_retorno_confirmada ? "Sim" : "Não",
          })) || [];
        break;
      case "timeoff":
        sheetName = "Folgas";
        data =
          timeOff?.map((item) => ({
            Funcionário: item.employees?.nome_completo,
            Cargo: item.employees?.cargo,
            Data: format(dataBR(item.data), "dd/MM/yyyy"),
            Motivo: item.motivo,
          })) || [];
        break;
      case "faults":
        sheetName = "Faltas";
        data =
          faults?.map((item) => ({
            Funcionário: item.employees?.nome_completo,
            Cargo: item.employees?.cargo,
            Data: format(dataBR(item.data), "dd/MM/yyyy"),
            Justificada: item.justificada ? "Sim" : "Não",
            Motivo: item.motivo || "-",
          })) || [];
        break;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `relatorio-frequencia-${new Date().getTime()}.xlsx`);
  };

  const isLoading = loadingAbsences || loadingVacations || loadingTimeOff || loadingFaults;
  const currentData =
    reportType === "absences"
      ? absences
      : reportType === "vacations"
        ? vacations
        : reportType === "timeoff"
          ? timeOff
          : faults;

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
                  <SelectItem value="absences">Afastamentos</SelectItem>
                  <SelectItem value="vacations">Férias</SelectItem>
                  <SelectItem value="timeoff">Folgas</SelectItem>
                  <SelectItem value="faults">Faltas</SelectItem>
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
            {reportType === "absences"
              ? "Afastamentos"
              : reportType === "vacations"
                ? "Férias"
                : reportType === "timeoff"
                  ? "Folgas"
                  : "Faltas"}
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
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Cargo</TableHead>
                    {reportType === "absences" && (
                      <>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Fim</TableHead>
                      </>
                    )}
                    {reportType === "vacations" && (
                      <>
                        <TableHead>Início Gozo</TableHead>
                        <TableHead>Fim Gozo</TableHead>
                        <TableHead>Dias</TableHead>
                      </>
                    )}
                    {reportType === "timeoff" && (
                      <>
                        <TableHead>Data</TableHead>
                        <TableHead>Motivo</TableHead>
                      </>
                    )}
                    {reportType === "faults" && (
                      <>
                        <TableHead>Data</TableHead>
                        <TableHead>Justificada</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentData.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.employees?.nome_completo}
                      </TableCell>
                      <TableCell>{item.employees?.cargo}</TableCell>
                      {reportType === "absences" && (
                        <>
                          <TableCell>{item.motivo}</TableCell>
                          <TableCell>
                            {format((parseDateOnly(item.data_inicio) ?? new Date()), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            {format((parseDateOnly(item.data_fim) ?? new Date()), "dd/MM/yyyy")}
                          </TableCell>
                        </>
                      )}
                      {reportType === "vacations" && (
                        <>
                          <TableCell>
                            {format((parseDateOnly(item.periodo_gozo_inicio) ?? new Date()), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            {format((parseDateOnly(item.periodo_gozo_fim) ?? new Date()), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>{item.dias_totais}</TableCell>
                        </>
                      )}
                      {reportType === "timeoff" && (
                        <>
                          <TableCell>{format(dataBR(item.data), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{item.motivo}</TableCell>
                        </>
                      )}
                      {reportType === "faults" && (
                        <>
                          <TableCell>{format(dataBR(item.data), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{item.justificada ? "Sim" : "Não"}</TableCell>
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

export default AttendanceReports;

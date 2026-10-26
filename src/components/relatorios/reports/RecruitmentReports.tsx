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

const RecruitmentReports = () => {
  const [selectedVaga, setSelectedVaga] = useState("all");

  const { data: vagas } = useQuery({
    queryKey: ["vagas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vagas").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: candidaturas, isLoading } = useQuery({
    queryKey: ["candidaturas-report", selectedVaga],
    queryFn: async () => {
      let query = supabase.from("candidaturas").select("*, vagas(titulo)");

      if (selectedVaga !== "all") {
        query = query.eq("vaga_id", selectedVaga);
      }

      const { data, error } = await query.order("data_candidatura", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const exportToPDF = () => {
    const doc = new jsPDF();
    const title = "Relatório de Candidaturas";

    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Total: ${candidaturas?.length || 0} candidaturas`, 14, 36);

    let yPos = 46;
    candidaturas?.forEach((item, index) => {
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      doc.text(`${index + 1}. ${item.nome_completo}`, 14, yPos);
      doc.text(`Vaga: ${item.vagas?.titulo}`, 20, yPos + 6);
      doc.text(`Status: ${item.status}`, 20, yPos + 12);
      doc.text(`Email: ${item.email}`, 20, yPos + 18);
      doc.text(`Telefone: ${item.telefone}`, 20, yPos + 24);

      yPos += 32;
    });

    doc.save(`relatorio-candidaturas-${new Date().getTime()}.pdf`);
  };

  const exportToExcel = () => {
    const data = candidaturas?.map((item) => ({
      Nome: item.nome_completo,
      Email: item.email,
      Telefone: item.telefone,
      CPF: item.cpf,
      Vaga: item.vagas?.titulo,
      Status: item.status,
      "Data Candidatura": item.data_candidatura
        ? format(dataBR(item.data_candidatura), "dd/MM/yyyy")
        : "-",
      "Nota Avaliação": item.nota_avaliacao || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(data || []);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Candidaturas");
    XLSX.writeFile(wb, `relatorio-candidaturas-${new Date().getTime()}.xlsx`);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      nova: "secondary",
      em_analise: "default",
      entrevista_agendada: "default",
      aprovada: "default",
      reprovada: "destructive",
      contratada: "default",
    };

    const labels: Record<string, string> = {
      nova: "Nova",
      em_analise: "Em Análise",
      entrevista_agendada: "Entrevista Agendada",
      aprovada: "Aprovada",
      reprovada: "Reprovada",
      contratada: "Contratada",
    };

    return (
      <Badge variant={variants[status] || "secondary"}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Relatório</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vaga</Label>
              <Select value={selectedVaga} onValueChange={setSelectedVaga}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {vagas?.map((vaga) => (
                    <SelectItem key={vaga.id} value={vaga.id}>
                      {vaga.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <ExportButtons
              onExportPDF={exportToPDF}
              onExportExcel={exportToExcel}
              disabled={!candidaturas || candidaturas.length === 0}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Candidaturas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Total: {candidaturas?.length || 0} candidaturas
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : candidaturas && candidaturas.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Vaga</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidaturas.map((candidatura) => (
                    <TableRow key={candidatura.id}>
                      <TableCell className="font-medium">
                        {candidatura.nome_completo}
                      </TableCell>
                      <TableCell>{candidatura.vagas?.titulo}</TableCell>
                      <TableCell>{candidatura.email}</TableCell>
                      <TableCell>{candidatura.telefone}</TableCell>
                      <TableCell>{getStatusBadge(candidatura.status || "")}</TableCell>
                      <TableCell>
                        {candidatura.data_candidatura
                          ? format(dataBR(candidatura.data_candidatura), "dd/MM/yyyy")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma candidatura encontrada
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RecruitmentReports;

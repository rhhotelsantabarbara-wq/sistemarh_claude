import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileBarChart, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { dataBR } from "@/lib/date";

type Section = { titulo: string; rows: any[]; head: string[]; mapRow: (r: any) => any[] };

export default function NR1Relatorios() {
  const [data, setData] = useState<Record<string, any[]>>({});

  useEffect(() => {
    (async () => {
      const [d, c, r, t, tc, a, lp, lr] = await Promise.all([
        (supabase.from("nr1_denuncias") as any).select("*").order("created_at", { ascending: false }),
        (supabase.from("nr1_pesquisas_clima") as any).select("*"),
        (supabase.from("nr1_riscos") as any).select("*"),
        (supabase.from("nr1_treinamentos") as any).select("*"),
        (supabase.from("nr1_treinamento_conclusoes") as any).select("*"),
        (supabase.from("nr1_acoes_preventivas") as any).select("*"),
        (supabase.from("nr1_lideranca_pesquisas") as any).select("*"),
        (supabase.from("nr1_lideranca_respostas") as any).select("*"),
      ]);
      setData({
        denuncias: d.data || [], clima: c.data || [], riscos: r.data || [],
        treinamentos: t.data || [], conclusoes: tc.data || [], acoes: a.data || [],
        lideranca_pesquisas: lp.data || [], lideranca_respostas: lr.data || [],
      });
    })();
  }, []);

  const sections: Section[] = [
    { titulo: "Denúncias", rows: data.denuncias || [], head: ["Protocolo", "Categoria", "Status", "Data"], mapRow: (r) => [r.protocolo, r.categoria, r.status, dataBR(r.created_at).toLocaleDateString("pt-BR")] },
    { titulo: "Riscos Psicossociais", rows: data.riscos || [], head: ["Categoria", "Prob.", "Sev.", "Status"], mapRow: (r) => [r.categoria, r.probabilidade, r.severidade, r.status] },
    { titulo: "Treinamentos", rows: data.treinamentos || [], head: ["Título", "Categoria", "Carga", "Obrigatório"], mapRow: (r) => [r.titulo, r.categoria, r.carga_horaria + "h", r.obrigatorio ? "Sim" : "Não"] },
    { titulo: "Ações Preventivas", rows: data.acoes || [], head: ["Título", "Prioridade", "Status", "Prazo"], mapRow: (r) => [r.titulo, r.prioridade, r.status, r.prazo || "—"] },
    { titulo: "Pesquisas de Clima", rows: data.clima || [], head: ["Título", "Status", "Início", "Fim"], mapRow: (r) => [r.titulo, r.status, r.data_inicio, r.data_fim || "—"] },
    { titulo: "Pesquisas de Liderança", rows: data.lideranca_pesquisas || [], head: ["Título", "Ativa", "Início", "Fim"], mapRow: (r) => [r.titulo, r.ativa ? "Sim" : "Não", r.data_inicio, r.data_fim || "—"] },
  ];

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("Relatório NR-1 | Gestão Psicossocial", 14, 15);
    doc.setFontSize(10); doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 22);
    let y = 30;
    sections.forEach((s) => {
      doc.setFontSize(12); doc.text(`${s.titulo} (${s.rows.length})`, 14, y); y += 4;
      autoTable(doc, { startY: y, head: [s.head], body: s.rows.map(s.mapRow), styles: { fontSize: 8 }, headStyles: { fillColor: [79, 70, 229] } });
      y = (doc as any).lastAutoTable.finalY + 8;
      if (y > 260) { doc.addPage(); y = 15; }
    });
    doc.save(`relatorio-nr1-${Date.now()}.pdf`);
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    sections.forEach((s) => {
      const ws = XLSX.utils.aoa_to_sheet([s.head, ...s.rows.map(s.mapRow)]);
      XLSX.utils.book_append_sheet(wb, ws, s.titulo.slice(0, 31));
    });
    XLSX.writeFile(wb, `relatorio-nr1-${Date.now()}.xlsx`);
  };

  return (
    <div className="container mx-auto p-0 sm:p-2 lg:p-4 space-y-6">
      <div className="flex-wrap gap-3 flex items-center justify-between">
        <div className="flex items-center gap-3"><FileBarChart className="h-5 w-5 text-primary" /><h1 className="text-xl font-medium leading-tight">Relatórios NR-1</h1></div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportPDF}><Download className="h-4 w-4 mr-2" />PDF</Button>
          <Button onClick={exportExcel} variant="outline"><Download className="h-4 w-4 mr-2" />Excel</Button>
        </div>
      </div>

      <Tabs defaultValue={sections[0].titulo}>
        <TabsList className="flex-wrap h-auto">
          {sections.map((s) => <TabsTrigger key={s.titulo} value={s.titulo}>{s.titulo} ({s.rows.length})</TabsTrigger>)}
        </TabsList>
        {sections.map((s) => (
          <TabsContent key={s.titulo} value={s.titulo}>
            <Card className="shadow-elegant">
              <Table>
                <TableHeader><TableRow>{s.head.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {s.rows.map((r, i) => (
                    <TableRow key={i}>{s.mapRow(r).map((v, j) => <TableCell key={j}>{v}</TableCell>)}</TableRow>
                  ))}
                  {!s.rows.length && <TableRow><TableCell colSpan={s.head.length} className="text-center text-muted-foreground py-8">Sem dados</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

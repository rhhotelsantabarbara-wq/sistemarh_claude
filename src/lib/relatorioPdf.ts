// Gerador padrão dos relatórios em PDF: cabeçalho com título, data e filtros,
// quadro-resumo por grupo e uma tabela por grupo (com subtítulo e total),
// rodapé com número de página. Usado pela Central de Relatórios.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAndBackup } from "./pdfBackupHelper";

export interface GrupoRelatorio {
  titulo: string;
  linhas: (string | number)[][];
}

export interface OpcoesRelatorio {
  titulo: string;
  empresa?: string;
  filtros?: string[]; // ex.: ["Status: ativos", "Empresa: todas"]
  colunas: string[];
  larguras?: Record<number, number>; // largura (mm) por índice de coluna
  grupos: GrupoRelatorio[];
  rotuloGrupo?: string; // ex.: "Setor" (aparece no resumo)
  paisagem?: boolean;
  nomeArquivo: string;
  tipoBackup?: string;
}

const AZUL: [number, number, number] = [10, 102, 228];
const CINZA_TEXTO: [number, number, number] = [90, 98, 112];
const CINZA_FUNDO: [number, number, number] = [244, 246, 250];

export function gerarRelatorioPdf(o: OpcoesRelatorio) {
  const doc = new jsPDF({ orientation: o.paisagem ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const margem = 14;
  const total = o.grupos.reduce((s, g) => s + g.linhas.length, 0);
  const agora = new Date();
  const dataTxt = agora.toLocaleDateString("pt-BR") + " às " + agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // Cabeçalho
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, largura, 4, "F");
  doc.setTextColor(30, 36, 51);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(o.titulo, margem, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...CINZA_TEXTO);
  doc.text(o.empresa || "Hotel Fazenda Santa Bárbara", margem, 22);
  doc.text(`Gerado em ${dataTxt}`, largura - margem, 16, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 36, 51);
  doc.setFontSize(11);
  doc.text(`${total} ${total === 1 ? "registro" : "registros"}`, largura - margem, 22, { align: "right" });

  let y = 27;
  if (o.filtros && o.filtros.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...CINZA_TEXTO);
    const linhasFiltro = doc.splitTextToSize("Filtros: " + o.filtros.join("  ·  "), largura - margem * 2);
    doc.text(linhasFiltro, margem, y + 2);
    y += 4 * linhasFiltro.length + 2;
  }

  // Resumo por grupo (só quando há mais de um grupo)
  if (o.grupos.length > 1) {
    autoTable(doc, {
      startY: y + 2,
      margin: { left: margem, right: margem },
      head: [[o.rotuloGrupo || "Grupo", "Quantidade", "%"]],
      body: o.grupos.map((g) => [g.titulo, String(g.linhas.length), total ? ((g.linhas.length / total) * 100).toFixed(1).replace(".", ",") + "%" : "0%"]),
      foot: [["Total", String(total), "100%"]],
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 1.8, lineColor: [226, 230, 238], lineWidth: 0.2 },
      headStyles: { fillColor: AZUL, textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: CINZA_FUNDO, textColor: [30, 36, 51], fontStyle: "bold" },
      columnStyles: { 1: { halign: "right", cellWidth: 30 }, 2: { halign: "right", cellWidth: 22 } },
      tableWidth: Math.min(130, largura - margem * 2),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  } else {
    y += 2;
  }

  // Uma tabela por grupo
  for (const g of o.grupos) {
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = 16;
    }
    if (o.grupos.length > 1 || g.titulo) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(...AZUL);
      doc.text(g.titulo, margem, y + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...CINZA_TEXTO);
      doc.text(`${g.linhas.length} ${g.linhas.length === 1 ? "pessoa" : "pessoas"}`, largura - margem, y + 4, { align: "right" });
      y += 6;
    }
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem, top: 14 },
      head: [["#", ...o.colunas]],
      body: g.linhas.map((l, i) => [String(i + 1), ...l.map((c) => (c === null || c === undefined || c === "" ? "—" : String(c)))]),
      theme: "striped",
      styles: { fontSize: 8.5, cellPadding: 1.8, overflow: "linebreak", textColor: [30, 36, 51] },
      headStyles: { fillColor: [232, 239, 252], textColor: [10, 70, 160], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 251, 253] },
      columnStyles: { 0: { cellWidth: 8, halign: "right", textColor: CINZA_TEXTO }, ...Object.fromEntries(Object.entries(o.larguras || {}).map(([k, w]) => [Number(k) + 1, { cellWidth: w }])) },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Rodapé
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    const altura = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...CINZA_TEXTO);
    doc.text(`${o.titulo} · Cérebrum RH`, margem, altura - 7);
    doc.text(`Página ${i} de ${paginas}`, largura - margem, altura - 7, { align: "right" });
  }

  saveAndBackup(doc, o.nomeArquivo, o.tipoBackup || "Relatórios");
}

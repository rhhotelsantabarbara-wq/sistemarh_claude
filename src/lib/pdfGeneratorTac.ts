import jsPDF from "jspdf";
import { saveAndBackup } from "./pdfBackupHelper";

const tipoLabels: Record<string, string> = {
  advertencia_verbal: "Advertência Verbal",
  advertencia_escrita: "Advertência Escrita",
  suspensao: "Suspensão",
  compromisso: "Termo de Compromisso",
};

export const generateTacPDF = async (tac: any) => {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("TERMO DE AJUSTAMENTO DE CONDUTA", pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(tipoLabels[tac.tipo] || tac.tipo, pageWidth / 2, y, { align: "center" });
  y += 10;

  // Line
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Employee info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO COLABORADOR", margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  const employeeName = tac.employees?.nome_completo || "N/A";
  const employeeCargo = tac.employees?.cargo || "N/A";
  const employeeSetor = tac.employees?.setor || "N/A";
  const employeeEmpresa = tac.employees?.empresas?.nome || "N/A";

  doc.text(`Nome: ${employeeName}`, margin, y);
  y += 6;
  doc.text(`Cargo: ${employeeCargo}`, margin, y);
  doc.text(`Setor: ${employeeSetor}`, pageWidth / 2, y);
  y += 6;
  doc.text(`Empresa: ${employeeEmpresa}`, margin, y);
  y += 10;

  // Line
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // TAC info
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO TERMO", margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.text(`Título: ${tac.titulo}`, margin, y);
  y += 6;
  doc.text(`Tipo: ${tipoLabels[tac.tipo] || tac.tipo}`, margin, y);
  y += 6;
  doc.text(`Data da Ocorrência: ${new Date(tac.data_ocorrencia).toLocaleDateString("pt-BR")}`, margin, y);
  y += 6;
  doc.text(`Data de Publicação: ${new Date(tac.data_publicacao).toLocaleDateString("pt-BR")}`, margin, y);
  y += 10;

  // Description
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIÇÃO", margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  const descLines = doc.splitTextToSize(tac.descricao || "", contentWidth);
  descLines.forEach((line: string) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, margin, y);
    y += 5;
  });
  y += 5;

  // Observations
  if (tac.observacoes) {
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVAÇÕES", margin, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    const obsLines = doc.splitTextToSize(tac.observacoes, contentWidth);
    obsLines.forEach((line: string) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += 5;
    });
    y += 5;
  }

  // Check if we need a new page for signatures
  if (y > 220) {
    doc.addPage();
    y = 20;
  }

  // Acknowledgment text
  y += 10;
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const ackText = "Declaro que recebi, li e compreendi o conteúdo deste Termo de Ajustamento de Conduta, estando ciente das condições aqui descritas e das consequências em caso de descumprimento.";
  const ackLines = doc.splitTextToSize(ackText, contentWidth);
  ackLines.forEach((line: string) => {
    doc.text(line, margin, y);
    y += 5;
  });

  y += 5;
  const today = new Date().toLocaleDateString("pt-BR");
  doc.text(`Data: ${today}`, margin, y);
  y += 15;

  // Signature lines
  const sigWidth = (contentWidth - 20) / 2;

  // Employee signature
  doc.line(margin, y, margin + sigWidth, y);
  y += 5;
  doc.setFontSize(9);
  doc.text("Assinatura do Colaborador", margin, y);
  doc.text(employeeName, margin, y + 5);

  // Manager signature
  const rightX = margin + sigWidth + 20;
  doc.line(rightX, y - 5, rightX + sigWidth, y - 5);
  doc.text("Assinatura do Responsável", rightX, y);

  y += 20;

  // Witness lines
  doc.line(margin, y, margin + sigWidth, y);
  y += 5;
  doc.text("Testemunha 1", margin, y);

  doc.line(margin + sigWidth + 20, y - 5, pageWidth - margin, y - 5);
  doc.text("Testemunha 2", margin + sigWidth + 20, y);

  // Save
  const fileName = `TAC_${employeeName.replace(/\s+/g, "_")}_${new Date(tac.data_ocorrencia).toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`;
  saveAndBackup(doc, fileName, "TACs", { employee_id: tac.employee_id });
};

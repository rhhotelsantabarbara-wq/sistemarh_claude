import jsPDF from "jspdf";
import { backupPdfToDrive } from "@/hooks/useDriveBackup";
import { saveAndBackup } from "./pdfBackupHelper";

export interface PdfOutputOptions {
  silent?: boolean;
  subpasta?: string;
  employee_id?: string | null;
}

async function handleOutput(doc: jsPDF, fileName: string, tipo: string, opts: PdfOutputOptions) {
  if (opts.silent) {
    const blob: Blob = doc.output("blob");
    await backupPdfToDrive({
      tipo,
      nome_arquivo: fileName,
      pdfBlob: blob,
      employee_id: opts.employee_id ?? null,
      subpasta: opts.subpasta,
    });
  } else {
    saveAndBackup(doc, fileName, tipo, { employee_id: opts.employee_id, subpasta: opts.subpasta });
  }
}


export interface EpiReceiptData {
  employeeName: string;
  employeeCpf: string;
  employeeRole: string;
  tipoEpi: string;
  quantidade: number;
  dataEntrega: string;
  observacoes?: string | null;
  marcaModelo?: string | null;
  ca?: string | null;
  tamanho?: string | null;
  finalidade?: string | null;
  assinatura?: string | null;
  empresaNome?: string | null;
  empresaCnpj?: string | null;
}

export interface UniformReceiptData {
  employeeName: string;
  employeeCpf: string;
  employeeRole: string;
  tipoUniforme: string;
  tamanho: string;
  quantidade: number;
  dataEntrega: string;
  observacoes?: string | null;
  assinatura?: string | null;
  empresaNome?: string | null;
  empresaCnpj?: string | null;
}

export const generateEpiReceipt = async (data: EpiReceiptData, opts: PdfOutputOptions = {}) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  // Header
  const companyName = data.empresaNome || "Empresa";
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, pageWidth / 2, yPosition, { align: "center" });
  
  if (data.empresaCnpj) {
    yPosition += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`CNPJ: ${data.empresaCnpj}`, pageWidth / 2, yPosition, { align: "center" });
  }
  
  yPosition += 10;
  doc.setFontSize(12);
  doc.text("RECIBO DE ENTREGA DE EPI", pageWidth / 2, yPosition, { align: "center" });
  
  yPosition += 15;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  // Introduction
  const introText = `Eu, ${data.employeeName}, CPF nº ${data.employeeCpf}, colaborador(a) ${companyName ? `da empresa ${companyName}` : ""}, exercendo a função de ${data.employeeRole}, declaro que recebi nesta data os Equipamentos de Proteção Individual (EPIs) descritos abaixo:`;
  const splitIntro = doc.splitTextToSize(introText, pageWidth - 40);
  doc.text(splitIntro, 20, yPosition);
  yPosition += splitIntro.length * 5 + 10;

  // EPIs ENTREGUES Section
  doc.setFont("helvetica", "bold");
  doc.text("EPIs ENTREGUES", 20, yPosition);
  yPosition += 8;
  doc.setFont("helvetica", "normal");

  doc.text(`EPI: ${data.tipoEpi}`, 20, yPosition);
  yPosition += 6;
  
  doc.text(`Marca/Modelo: ${data.marcaModelo || 'Não informado'}`, 20, yPosition);
  yPosition += 6;
  
  doc.text(`CA (Certificado de Aprovação): ${data.ca || 'Não informado'}`, 20, yPosition);
  yPosition += 6;
  
  doc.text(`Quantidade: ${data.quantidade}`, 20, yPosition);
  yPosition += 6;
  
  doc.text(`Tamanho (se aplicável): ${data.tamanho || 'Não aplicável'}`, 20, yPosition);
  yPosition += 6;
  
  doc.text(`Finalidade/Proteção: ${data.finalidade || 'Não informado'}`, 20, yPosition);
  yPosition += 6;
  
  const formattedDate = new Date(data.dataEntrega).toLocaleDateString("pt-BR");
  doc.text(`Data da Entrega: ${formattedDate}`, 20, yPosition);
  yPosition += 12;

  if (data.observacoes) {
    doc.text(`Observações: ${data.observacoes}`, 20, yPosition);
    yPosition += 10;
  }

  // DECLARAÇÃO DO COLABORADOR
  doc.setFont("helvetica", "bold");
  doc.text("DECLARAÇÃO DO COLABORADOR", 20, yPosition);
  yPosition += 8;
  doc.setFont("helvetica", "normal");

  const declaration = [
    "Declaro que recebi os EPIs acima listados em perfeito estado de conservação e funcionamento.",
    "Fui devidamente orientado(a) sobre o uso correto, ajuste, higienização, guarda e substituição, conforme determina a NR-06.",
    "Comprometo-me a utilizar os equipamentos durante toda a jornada de trabalho, conforme orientação da empresa, sendo responsável por sua conservação e comunicação imediata em caso de dano ou necessidade de troca.",
    "Estou ciente de que o uso inadequado, o não uso ou a perda dos EPIs pode acarretar medidas disciplinares e riscos à minha saúde e segurança."
  ];

  declaration.forEach((line) => {
    const splitLine = doc.splitTextToSize(line, pageWidth - 40);
    doc.text(splitLine, 20, yPosition);
    yPosition += splitLine.length * 5 + 3;
  });

  yPosition += 10;

  // ASSINATURAS
  doc.setFont("helvetica", "bold");
  doc.text("ASSINATURAS", 20, yPosition);
  yPosition += 10;
  doc.setFont("helvetica", "normal");

  // Colaborador
  doc.text("Colaborador(a):", 20, yPosition);
  yPosition += 6;
  
  if (data.assinatura) {
    doc.addImage(data.assinatura, 'PNG', 20, yPosition, 80, 20);
    yPosition += 22;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("* ASSINATURA COLHIDA DIGITALMENTE", 20, yPosition);
    yPosition += 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
  } else {
    doc.text("Assinatura: ____________________________________", 20, yPosition);
    yPosition += 10;
  }
  
  doc.text(`Data: ${formattedDate}`, 20, yPosition);
  yPosition += 12;

  // Responsável
  doc.text("Responsável pela Entrega (Hotel):", 20, yPosition);
  yPosition += 6;
  doc.text("Nome: _________________________________________", 20, yPosition);
  yPosition += 6;
  doc.text("Cargo: ________________________________________", 20, yPosition);
  yPosition += 6;
  doc.text("Assinatura: ____________________________________", 20, yPosition);
  yPosition += 6;
  doc.text(`Data: ${formattedDate}`, 20, yPosition);

  // Save the PDF
  const fileName = `Recibo_EPI_${data.employeeName.replace(/\s+/g, "_")}_${formattedDate.replace(/\//g, "-")}.pdf`;
  await handleOutput(doc, fileName, "EPIs", opts);
};

export const generateUniformReceipt = async (data: UniformReceiptData, opts: PdfOutputOptions = {}) => {

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  // Header
  const companyName = data.empresaNome || "Empresa";
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, pageWidth / 2, yPosition, { align: "center" });
  
  if (data.empresaCnpj) {
    yPosition += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`CNPJ: ${data.empresaCnpj}`, pageWidth / 2, yPosition, { align: "center" });
  }
  
  yPosition += 10;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("RECIBO DE ENTREGA DE UNIFORME", pageWidth / 2, yPosition, { align: "center" });
  
  yPosition += 15;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  // Introduction
  const introText = `Eu, ${data.employeeName}, CPF nº ${data.employeeCpf}, colaborador(a) ${companyName ? `da empresa ${companyName}` : ""}, exercendo a função de ${data.employeeRole}, declaro que recebi nesta data os uniformes descritos abaixo:`;
  const splitIntro = doc.splitTextToSize(introText, pageWidth - 40);
  doc.text(splitIntro, 20, yPosition);
  yPosition += splitIntro.length * 5 + 10;

  // UNIFORMES ENTREGUES Section
  doc.setFont("helvetica", "bold");
  doc.text("UNIFORMES ENTREGUES", 20, yPosition);
  yPosition += 8;
  doc.setFont("helvetica", "normal");

  doc.text(`Tipo de Uniforme: ${data.tipoUniforme}`, 20, yPosition);
  yPosition += 6;
  
  doc.text(`Tamanho: ${data.tamanho}`, 20, yPosition);
  yPosition += 6;
  
  doc.text(`Quantidade: ${data.quantidade}`, 20, yPosition);
  yPosition += 6;
  
  const formattedDate = new Date(data.dataEntrega).toLocaleDateString("pt-BR");
  doc.text(`Data da Entrega: ${formattedDate}`, 20, yPosition);
  yPosition += 12;

  if (data.observacoes) {
    doc.text(`Observações: ${data.observacoes}`, 20, yPosition);
    yPosition += 10;
  }

  // DECLARAÇÃO DO COLABORADOR
  doc.setFont("helvetica", "bold");
  doc.text("DECLARAÇÃO DO COLABORADOR", 20, yPosition);
  yPosition += 8;
  doc.setFont("helvetica", "normal");

  const declaration = [
    "Declaro que recebi os uniformes acima listados em perfeito estado de conservação.",
    "Comprometo-me a utilizar o uniforme durante toda a jornada de trabalho, mantendo-o limpo e em bom estado.",
    "Estou ciente de que sou responsável pela conservação dos uniformes recebidos e comunicarei imediatamente em caso de dano ou necessidade de reposição.",
    "Estou ciente de que o uso inadequado ou a não utilização do uniforme pode acarretar medidas disciplinares."
  ];

  declaration.forEach((line) => {
    const splitLine = doc.splitTextToSize(line, pageWidth - 40);
    doc.text(splitLine, 20, yPosition);
    yPosition += splitLine.length * 5 + 3;
  });

  yPosition += 10;

  // ASSINATURAS
  doc.setFont("helvetica", "bold");
  doc.text("ASSINATURAS", 20, yPosition);
  yPosition += 10;
  doc.setFont("helvetica", "normal");

  // Colaborador
  doc.text("Colaborador(a):", 20, yPosition);
  yPosition += 6;
  
  if (data.assinatura) {
    doc.addImage(data.assinatura, 'PNG', 20, yPosition, 80, 20);
    yPosition += 22;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("* ASSINATURA COLHIDA DIGITALMENTE", 20, yPosition);
    yPosition += 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
  } else {
    doc.text("Assinatura: ____________________________________", 20, yPosition);
    yPosition += 10;
  }
  
  doc.text(`Data: ${formattedDate}`, 20, yPosition);
  yPosition += 12;

  // Responsável
  doc.text("Responsável pela Entrega (Hotel):", 20, yPosition);
  yPosition += 6;
  doc.text("Nome: _________________________________________", 20, yPosition);
  yPosition += 6;
  doc.text("Cargo: ________________________________________", 20, yPosition);
  yPosition += 6;
  doc.text("Assinatura: ____________________________________", 20, yPosition);
  yPosition += 6;
  doc.text(`Data: ${formattedDate}`, 20, yPosition);

  // Save the PDF
  const fileName = `Recibo_Uniforme_${data.employeeName.replace(/\s+/g, "_")}_${formattedDate.replace(/\//g, "-")}.pdf`;
  await handleOutput(doc, fileName, "Uniformes", opts);

};

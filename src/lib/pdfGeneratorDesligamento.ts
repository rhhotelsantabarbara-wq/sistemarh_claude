import jsPDF from "jspdf";
import { parseDateOnly } from "@/lib/date";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { saveAndBackup } from "./pdfBackupHelper";

interface DadosDesligamento {
  funcionario: {
    nome_completo: string;
    cargo: string;
    cpf: string;
    data_admissao: string;
    setor?: string;
  };
  empresa: {
    nome: string;
    cnpj?: string;
    endereco?: string;
    logo_url?: string;
  };
  tipoDesligamento: "pedido_demissao" | "dispensa_empresa";
  motivoDesligamento: string;
  avisoTipo: "trabalhado" | "indenizado";
  diasAviso: number;
  dataDesligamento: Date;
  dataFimAviso: Date;
  observacoes?: string;
}

const motivoLabels: Record<string, string> = {
  sem_justa_causa: "sem justa causa",
  com_justa_causa: "com justa causa",
  acordo_mutuo: "por acordo mútuo conforme Art. 484-A da CLT",
  termino_contrato: "por término de contrato",
  aposentadoria: "por aposentadoria",
  falecimento: "por falecimento",
  pedido_demissao: "a pedido do empregado",
};

export const gerarPedidoDemissao = (dados: DadosDesligamento) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 30;

  // Título
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("PEDIDO DE DEMISSÃO", pageWidth / 2, y, { align: "center" });
  y += 20;

  // Data e local
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const dataFormatada = format(dados.dataDesligamento, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  doc.text(`Local e data: __________________, ${dataFormatada}`, margin, y);
  y += 15;

  // Destinatário
  doc.text(`À ${dados.empresa.nome}`, margin, y);
  y += 6;
  if (dados.empresa.cnpj) {
    doc.text(`CNPJ: ${dados.empresa.cnpj}`, margin, y);
    y += 6;
  }
  y += 10;

  // Corpo do texto
  doc.setFontSize(11);
  const texto1 = `Eu, ${dados.funcionario.nome_completo}, portador(a) do CPF nº ${dados.funcionario.cpf || "_______________"}, ocupante do cargo de ${dados.funcionario.cargo}${dados.funcionario.setor ? ` no setor de ${dados.funcionario.setor}` : ""}, venho por meio desta comunicar minha demissão do emprego que ocupo nesta empresa.`;
  
  const lines1 = doc.splitTextToSize(texto1, pageWidth - margin * 2);
  doc.text(lines1, margin, y);
  y += lines1.length * 6 + 10;

  // Aviso prévio
  let textoAviso = "";
  if (dados.avisoTipo === "trabalhado") {
    textoAviso = `Informo que cumprirei o aviso prévio de ${dados.diasAviso} dias, com término previsto para ${format(dados.dataFimAviso, "dd/MM/yyyy")}.`;
  } else {
    textoAviso = `Solicito a dispensa do cumprimento do aviso prévio, estando ciente de que o período não trabalhado poderá ser descontado das verbas rescisórias, conforme legislação vigente.`;
  }
  
  const linesAviso = doc.splitTextToSize(textoAviso, pageWidth - margin * 2);
  doc.text(linesAviso, margin, y);
  y += linesAviso.length * 6 + 10;

  // Data de admissão
  const dataAdmissao = format((parseDateOnly(dados.funcionario.data_admissao) ?? new Date()), "dd/MM/yyyy");
  doc.text(`Data de admissão: ${dataAdmissao}`, margin, y);
  y += 15;

  // Observações
  if (dados.observacoes) {
    doc.text("Observações:", margin, y);
    y += 6;
    const linesObs = doc.splitTextToSize(dados.observacoes, pageWidth - margin * 2);
    doc.text(linesObs, margin, y);
    y += linesObs.length * 6 + 10;
  }

  // Encerramento
  doc.text("Sem mais para o momento, agradeço a oportunidade.", margin, y);
  y += 15;

  doc.text("Atenciosamente,", margin, y);
  y += 30;

  // Assinatura funcionário
  doc.line(margin, y, margin + 80, y);
  y += 5;
  doc.text(dados.funcionario.nome_completo, margin, y);
  y += 5;
  doc.setFontSize(9);
  doc.text(`CPF: ${dados.funcionario.cpf || "_______________"}`, margin, y);
  y += 20;

  // Recebido por
  doc.setFontSize(11);
  doc.text("Recebido em: ____/____/________", margin, y);
  y += 15;
  doc.line(margin, y, margin + 80, y);
  y += 5;
  doc.text("Assinatura do responsável pela empresa", margin, y);

  const fileNamePD = `pedido_demissao_${dados.funcionario.nome_completo.replace(/\s+/g, "_")}.pdf`;
  saveAndBackup(doc, fileNamePD, "Desligamentos");
};

export const gerarCartaDemissao = (dados: DadosDesligamento) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 30;

  // Título
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("COMUNICADO DE DISPENSA", pageWidth / 2, y, { align: "center" });
  y += 20;

  // Data e local
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const dataFormatada = format(dados.dataDesligamento, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  doc.text(`Local e data: __________________, ${dataFormatada}`, margin, y);
  y += 15;

  // Destinatário
  doc.setFont("helvetica", "bold");
  doc.text(`Ao(À) Sr(a). ${dados.funcionario.nome_completo}`, margin, y);
  doc.setFont("helvetica", "normal");
  y += 6;
  doc.text(`CPF: ${dados.funcionario.cpf || "_______________"}`, margin, y);
  y += 15;

  // Corpo do texto
  const motivoTexto = motivoLabels[dados.motivoDesligamento] || dados.motivoDesligamento;
  
  const texto1 = `Pela presente, comunicamos que V.Sa. está sendo dispensado(a) ${motivoTexto} do cargo de ${dados.funcionario.cargo}${dados.funcionario.setor ? `, no setor de ${dados.funcionario.setor}` : ""}, que ocupa nesta empresa desde ${format((parseDateOnly(dados.funcionario.data_admissao) ?? new Date()), "dd/MM/yyyy")}.`;
  
  const lines1 = doc.splitTextToSize(texto1, pageWidth - margin * 2);
  doc.text(lines1, margin, y);
  y += lines1.length * 6 + 10;

  // Aviso prévio
  let textoAviso = "";
  if (dados.avisoTipo === "trabalhado") {
    textoAviso = `Informamos que deverá cumprir o aviso prévio de ${dados.diasAviso} dias, conforme Lei 12.506/2011, com término previsto para ${format(dados.dataFimAviso, "dd/MM/yyyy")}. Durante este período, poderá optar por reduzir 2 (duas) horas diárias de sua jornada de trabalho ou ausentar-se do trabalho por 7 (sete) dias corridos, sem prejuízo do salário integral, conforme Art. 488 da CLT.`;
  } else {
    textoAviso = `Informamos que fica dispensado(a) do cumprimento do aviso prévio de ${dados.diasAviso} dias, conforme Lei 12.506/2011, sendo este indenizado.`;
  }
  
  const linesAviso = doc.splitTextToSize(textoAviso, pageWidth - margin * 2);
  doc.text(linesAviso, margin, y);
  y += linesAviso.length * 6 + 10;

  // Cálculo do aviso
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  const textoCalculo = `* O aviso prévio de ${dados.diasAviso} dias foi calculado conforme Lei 12.506/2011: 30 dias base + ${dados.diasAviso - 30} dias proporcionais ao tempo de serviço.`;
  const linesCalculo = doc.splitTextToSize(textoCalculo, pageWidth - margin * 2);
  doc.text(linesCalculo, margin, y);
  y += linesCalculo.length * 5 + 10;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  // Observações
  if (dados.observacoes) {
    doc.text("Observações:", margin, y);
    y += 6;
    const linesObs = doc.splitTextToSize(dados.observacoes, pageWidth - margin * 2);
    doc.text(linesObs, margin, y);
    y += linesObs.length * 6 + 10;
  }

  // Verbas rescisórias
  doc.text("As verbas rescisórias serão pagas conforme legislação vigente.", margin, y);
  y += 15;

  // Assinatura empresa
  doc.line(margin, y, margin + 80, y);
  y += 5;
  doc.text(dados.empresa.nome, margin, y);
  if (dados.empresa.cnpj) {
    y += 5;
    doc.setFontSize(9);
    doc.text(`CNPJ: ${dados.empresa.cnpj}`, margin, y);
  }
  y += 20;

  // Ciência do funcionário
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("CIÊNCIA DO(A) EMPREGADO(A)", margin, y);
  doc.setFont("helvetica", "normal");
  y += 10;

  doc.text("Declaro ter recebido e estar ciente do presente comunicado.", margin, y);
  y += 15;

  doc.text("Data: ____/____/________", margin, y);
  y += 15;

  doc.line(margin, y, margin + 80, y);
  y += 5;
  doc.text(dados.funcionario.nome_completo, margin, y);
  y += 5;
  doc.setFontSize(9);
  doc.text(`CPF: ${dados.funcionario.cpf || "_______________"}`, margin, y);

  const fileNameCD = `carta_dispensa_${dados.funcionario.nome_completo.replace(/\s+/g, "_")}.pdf`;
  saveAndBackup(doc, fileNameCD, "Desligamentos");
};

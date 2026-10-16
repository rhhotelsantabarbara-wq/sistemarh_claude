import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { saveAndBackup } from "./pdfBackupHelper";

interface DadosSolicitacaoContaSalario {
  funcionario: {
    nome_completo: string;
    cpf: string;
    cargo: string;
  };
  empresa: {
    nome: string;
    cnpj: string;
    numero_convenio_bancario: string;
  };
}

export function gerarSolicitacaoContaSalario(dados: DadosSolicitacaoContaSalario) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  let yPos = 30;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("SOLICITAÇÃO DE ABERTURA DE CONTA SALÁRIO", pageWidth / 2, yPos, { align: "center" });
  
  yPos += 25;

  // Main content
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  
  const convenioText = `Solicitamos abertura de conta salário do convênio nº ${dados.empresa.numero_convenio_bancario || "___________"}, da empresa ${dados.empresa.nome}${dados.empresa.cnpj ? `, CNPJ: ${dados.empresa.cnpj}` : ""}.`;
  
  const lines = doc.splitTextToSize(convenioText, contentWidth);
  doc.text(lines, margin, yPos);
  yPos += lines.length * 7 + 15;

  // Collaborator section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("COLABORADOR", margin, yPos);
  yPos += 12;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  
  doc.text(`Nome do colaborador: ${dados.funcionario.nome_completo}`, margin, yPos);
  yPos += 10;
  
  doc.text(`CPF do colaborador: ${dados.funcionario.cpf || "_______________"}`, margin, yPos);
  yPos += 10;
  
  doc.text(`Função do colaborador: ${dados.funcionario.cargo}`, margin, yPos);
  yPos += 25;

  // Closing
  doc.text("Atenciosamente,", margin, yPos);
  yPos += 35;

  // Signature line
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  // Company info
  doc.setFontSize(10);
  doc.text(dados.empresa.nome, pageWidth / 2, yPos, { align: "center" });
  yPos += 6;
  if (dados.empresa.cnpj) {
    doc.text(`CNPJ: ${dados.empresa.cnpj}`, pageWidth / 2, yPos, { align: "center" });
  }

  // Date at bottom
  yPos += 20;
  const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  doc.text(`Data: ${dataAtual}`, margin, yPos);

  // Save PDF
  const fileName = `solicitacao_conta_salario_${dados.funcionario.nome_completo.replace(/\s/g, "_")}.pdf`;
  saveAndBackup(doc, fileName, "ContaSalario");
}

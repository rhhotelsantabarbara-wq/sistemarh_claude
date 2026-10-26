import jsPDF from "jspdf";
import { parseDateOnly, dataBR } from "@/lib/date";
import { saveAndBackup } from "./pdfBackupHelper";

export const generateEncaminhamentoPDF = async (encaminhamento: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Logo da empresa (se existir)
  if (encaminhamento.empresas?.logo_url) {
    try {
      // Baixar a imagem e converter para base64
      const response = await fetch(encaminhamento.empresas.logo_url);
      if (!response.ok) {
        throw new Error("Falha ao baixar logo");
      }

      const blob = await response.blob();
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Falha ao ler logo"));
        reader.readAsDataURL(blob);
      });

      // Centralizar a logo 50x50
      const logoX = (pageWidth - 50) / 2;

      // Detectar formato pela dataURL
      const format = dataUrl.includes("image/png") ? "PNG" : "JPEG";

      doc.addImage(dataUrl, format, logoX, yPos, 50, 50);
      yPos += 55;
    } catch (error) {
      console.error("Erro ao carregar logo:", error);
      // Continua sem a logo se houver erro
    }
  }

  // Título
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("GUIA DE ENCAMINHAMENTO EM SAUDE OCUPACIONAL", pageWidth / 2, yPos, {
    align: "center",
  });
  yPos += 15;

  // Dados da Empresa
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`CNPJ: ${encaminhamento.empresas?.cnpj || ""}`, 20, yPos);
  yPos += 6;
  doc.text(`EMPRESA: ${encaminhamento.empresas?.nome || ""}`, 20, yPos);
  yPos += 10;

  // Dados do Funcionário
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO FUNCIONARIO", 20, yPos);
  yPos += 7;
  doc.setFont("helvetica", "normal");
  
  doc.text(`NOME: ${encaminhamento.employees?.nome_completo || ""}`, 20, yPos);
  yPos += 6;
  doc.text(
    `DATA DE NASCIMENTO: ${
      encaminhamento.employees?.data_nascimento
        ? (parseDateOnly(encaminhamento.employees.data_nascimento) ?? new Date()).toLocaleDateString("pt-BR")
        : ""
    }`,
    20,
    yPos
  );
  yPos += 6;
  doc.text(`ENDERECO: ${encaminhamento.employees?.endereco || ""}`, 20, yPos);
  yPos += 6;
  
  const rgCpf = `RG: ${encaminhamento.employees?.rg || ""}                  CPF: ${encaminhamento.employees?.cpf || ""}`;
  doc.text(rgCpf, 20, yPos);
  yPos += 6;
  
  const ctpsInfo = `CTPS: ${encaminhamento.employees?.ctps || ""}`;
  doc.text(ctpsInfo, 20, yPos);
  yPos += 10;

  // Dados Ocupacionais
  doc.setFont("helvetica", "bold");
  doc.text("DADOS OCUPACIONAIS", 20, yPos);
  yPos += 7;
  doc.setFont("helvetica", "normal");
  
  doc.text(`FUNCAO: ${encaminhamento.funcao || ""}`, 20, yPos);
  yPos += 6;
  doc.text(`CBO: ${encaminhamento.cbo || ""}`, 20, yPos);
  yPos += 6;
  doc.text(`MATRICULA E-SOCIAL: ${encaminhamento.matricula_esocial || ""}`, 20, yPos);
  yPos += 10;

  // Condições Especiais - APENAS as selecionadas
  const condicoesAtivas = [];
  if (encaminhamento.beneficiario_reabilitado) {
    condicoesAtivas.push("BENEFICIARIO REABILITADO");
  }
  if (encaminhamento.portador_deficiencia) {
    condicoesAtivas.push("PORTADOR DE DEFICIENCIA HABILITADO");
  }
  if (encaminhamento.trabalho_altura) {
    condicoesAtivas.push("REALIZA TRABALHO EM ALTURA");
  }
  if (encaminhamento.espaco_confinado) {
    condicoesAtivas.push("TRABALHA EM ESPACO CONFINADO");
  }

  if (condicoesAtivas.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("CONDICOES ESPECIAIS", 20, yPos);
    yPos += 7;
    doc.setFont("helvetica", "normal");
    
    condicoesAtivas.forEach((condicao) => {
      doc.text(`- ${condicao}`, 20, yPos);
      yPos += 6;
    });
    yPos += 4;
  }

  // Data de Admissão
  doc.text(
    `DATA DE ADMISSAO: ${
      encaminhamento.employees?.data_admissao
        ? (parseDateOnly(encaminhamento.employees.data_admissao) ?? new Date()).toLocaleDateString("pt-BR")
        : ""
    }`,
    20,
    yPos
  );
  yPos += 10;

  // Tipo de Exame - APENAS o selecionado
  doc.setFont("helvetica", "bold");
  doc.text("TIPO DE EXAME:", 20, yPos);
  yPos += 7;
  doc.setFont("helvetica", "normal");
  
  const tipoExameMap: Record<string, string> = {
    admissional: "ADMISSIONAL",
    demissional: "DEMISSIONAL",
    periodico: "PERIODICO",
    mudanca_riscos: "MUDANCA DE RISCOS OCUPACIONAIS",
    retorno_trabalho: "RETORNO AO TRABALHO",
  };
  
  const tipoSelecionado = tipoExameMap[encaminhamento.tipo_exame];
  if (tipoSelecionado) {
    doc.text(`- ${tipoSelecionado}`, 20, yPos);
    yPos += 10;
  }

  // Descrição da Atividade
  if (encaminhamento.descricao_atividade) {
    doc.setFont("helvetica", "bold");
    doc.text("DESCRICAO DA ATIVIDADE:", 20, yPos);
    yPos += 7;
    doc.setFont("helvetica", "normal");
    
    const splitText = doc.splitTextToSize(encaminhamento.descricao_atividade, pageWidth - 40);
    doc.text(splitText, 20, yPos);
    yPos += splitText.length * 6 + 5;
  }

  // Observações
  if (encaminhamento.observacoes) {
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVACOES:", 20, yPos);
    yPos += 7;
    doc.setFont("helvetica", "normal");
    
    const splitObs = doc.splitTextToSize(encaminhamento.observacoes, pageWidth - 40);
    doc.text(splitObs, 20, yPos);
    yPos += splitObs.length * 6 + 10;
  }

  // Data de emissão
  yPos += 15;
  doc.setFontSize(9);
  doc.text(
    `Data de Emissao: ${dataBR(encaminhamento.data_encaminhamento).toLocaleDateString("pt-BR")}`,
    20,
    yPos
  );

  // Salvar PDF
  const fileName = `Encaminhamento_${encaminhamento.employees?.nome_completo?.replace(
    /\s+/g,
    "_"
  )}_${new Date().getTime()}.pdf`;
  saveAndBackup(doc, fileName, "Encaminhamentos", { employee_id: encaminhamento.employee_id });
};


import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { backupPdfToDrive } from "@/hooks/useDriveBackup";
import { saveAndBackup } from "./pdfBackupHelper";

export interface HoleriteAssinaturaInfo {
  protocolo: string;
  data_assinatura: string; // ISO
  assinatura_data_url: string; // base64 png/jpeg
  validacao_url: string; // URL pública do certificado
}

export interface HoleriteVariavel {
  id: string;
  nome: string;
  codigo?: string | null;
  tipo: "desconto" | "provento";
}

export interface HoleriteItem {
  id: string;
  variavel_id: string;
  valor: number;
  variaveis_folha: HoleriteVariavel;
}

export interface HoleritePagamento {
  id: string;
  employee_id: string;
  empresa_id: string;
  valor_bruto: number;
  desconto: number;
  descontos: number;
  valor_liquido: number;
  observacoes: string | null;
  mes: number;
  ano: number;
  tipo_folha: string;
  folha_pagamento_itens?: HoleriteItem[];
}

export interface HoleriteEmployee {
  nome_completo: string;
  cargo: string;
  cpf: string | null;
  data_admissao: string | null;
  setor: string | null;
  salario: number | null;
  tipo_salario: string | null;
}

export interface HoleriteEmpresa {
  nome: string;
  cnpj: string | null;
  logo_url?: string | null;
  endereco: string | null;
}

const MESES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

const formatCNPJ = (cnpj: string | null) => {
  if (!cnpj) return "";
  const c = cnpj.replace(/\D/g, "");
  if (c.length === 14) {
    return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
  }
  return cnpj;
};

const formatCPF = (cpf: string | null) => {
  if (!cpf) return "";
  const c = cpf.replace(/\D/g, "");
  if (c.length === 11) {
    return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
  }
  return cpf;
};

const formatDate = (date: string | null) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR");
};

function getSalarioBase(employee: HoleriteEmployee) {
  if (!employee?.salario) return { valor: 0, sufixo: "/M" };
  const tipo = employee.tipo_salario;
  const sufixo = tipo === "diaria" ? "/D" : tipo === "hora" ? "/H" : "/M";
  return { valor: employee.salario, sufixo };
}

function getTableData(pagamento: HoleritePagamento, employee: HoleriteEmployee) {
  const proventos = pagamento.folha_pagamento_itens?.filter(i => i.variaveis_folha?.tipo === "provento") || [];
  const descontosItens = pagamento.folha_pagamento_itens?.filter(i => i.variaveis_folha?.tipo === "desconto") || [];
  const totalProventosRegistrado = roundMoney(pagamento.valor_bruto || 0);
  const totalDescontosRegistrado = roundMoney((pagamento.desconto || 0) + (pagamento.descontos || 0));
  const somaProventosItens = roundMoney(proventos.reduce((s, p) => s + Number(p.valor || 0), 0));
  const somaDescontosItens = roundMoney(descontosItens.reduce((s, d) => s + Number(d.valor || 0), 0));
  const salarioBaseValor = roundMoney(Math.max(0, totalProventosRegistrado - somaProventosItens));
  const descontoSemRubrica = roundMoney(Math.max(0, totalDescontosRegistrado - somaDescontosItens));

  const rows: { cod: string; desc: string; ref: string; prov: string; desc2: string }[] = [];
  rows.push({ cod: "101", desc: "Salário Base", ref: "", prov: formatCurrency(salarioBaseValor), desc2: "" });
  proventos.forEach((item) => rows.push({
    cod: item.variaveis_folha?.codigo || "-",
    desc: item.variaveis_folha?.nome || "-",
    ref: "", prov: formatCurrency(item.valor), desc2: "",
  }));
  descontosItens.forEach((item) => rows.push({
    cod: item.variaveis_folha?.codigo || "-",
    desc: item.variaveis_folha?.nome || "-",
    ref: "", prov: "", desc2: formatCurrency(item.valor),
  }));

  if (descontoSemRubrica > 0.009) {
    rows.push({ cod: "-", desc: "Outros descontos", ref: "", prov: "", desc2: formatCurrency(descontoSemRubrica) });
  }

  // Holerite Diferença: se houver desconto extra do líquido do holerite principal
  // (gravado em pagamento.descontos mas sem item correspondente), renderiza linha virtual.
  let descontoLiquidoPrincipal = 0;
  if (pagamento.tipo_folha === "diferenca") {
    const somaItens = somaDescontosItens + descontoSemRubrica;
    const diff = (pagamento.descontos || 0) - somaItens;
    if (diff > 0.009) {
      descontoLiquidoPrincipal = diff;
      rows.push({
        cod: "—",
        desc: "Valor Líquido Holerite Principal",
        ref: "", prov: "", desc2: formatCurrency(diff),
      });
    }
  }

  while (rows.length < 8) rows.push({ cod: "", desc: "", ref: "", prov: "", desc2: "" });

  const totalProventos = totalProventosRegistrado;
  const totalDescontos = Math.max(somaDescontosItens + descontoSemRubrica, totalDescontosRegistrado) + descontoLiquidoPrincipal;
  return { rows, totalProventos, totalDescontos };
}

export interface GerarHoleriteOptions {
  silent?: boolean; // não baixa localmente, apenas envia ao Drive
  assinatura?: HoleriteAssinaturaInfo | null;
  returnBlob?: boolean; // retorna o Blob em vez de baixar (uso em lote)
}

/**
 * Gera o PDF do holerite. Por padrão baixa no navegador.
 * Quando { silent: true }, apenas envia para o Google Drive (uso em backup retroativo).
 * Quando { returnBlob: true }, retorna o Blob sem baixar nem enviar ao Drive.
 * Quando { assinatura }, embute a assinatura digital + QR code do certificado.
 */
export async function gerarHoleritePdf(
  pagamento: HoleritePagamento,
  empresa: HoleriteEmpresa,
  employee: HoleriteEmployee,
  options: GerarHoleriteOptions = {}
): Promise<Blob | void> {
  const doc = new jsPDF({ format: "a4", orientation: "portrait" });
  const pw = doc.internal.pageSize.getWidth();
  const ml = 10;
  const mr = 10;
  const cw = pw - ml - mr;
  let y = 12;

  const salarioBase = getSalarioBase(employee);
  const { rows, totalProventos, totalDescontos } = getTableData(pagamento, employee);
  const fgts = totalProventos * 0.08;
  const getMesAnoStr = () => `${MESES[pagamento.mes]}/${pagamento.ano}`;
  const assinatura = options.assinatura || null;
  let qrDataUrl = "";
  if (assinatura?.validacao_url) {
    try {
      qrDataUrl = await QRCode.toDataURL(assinatura.validacao_url, { margin: 0, width: 256 });
    } catch (e) {
      console.error("QR holerite falhou", e);
    }
  }
  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
      });
    } catch { return iso; }
  };

  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.6);

  // Cabeçalho empresa
  doc.setFillColor(33, 37, 41);
  doc.rect(ml, y, cw, 14, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text((empresa.nome || "").toUpperCase(), ml + cw / 2, y + 5.5, { align: "center" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`CNPJ: ${formatCNPJ(empresa.cnpj)}${empresa.endereco ? '  |  ' + empresa.endereco : ''}`, ml + cw / 2, y + 10.5, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 15;

  // Título
  doc.setFillColor(240, 240, 240);
  doc.rect(ml, y, cw, 7, "F");
  doc.setDrawColor(200, 200, 200);
  doc.rect(ml, y, cw, 7);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(33, 37, 41);
  const titulo =
    pagamento.tipo_folha === "diferenca"
      ? "RECIBO DE PAGAMENTO - DIFERENÇA"
      : "RECIBO DE PAGAMENTO DE SALÁRIO";
  doc.text(titulo, ml + cw / 2, y + 5, { align: "center" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(getMesAnoStr(), ml + cw - 4, y + 5, { align: "right" });
  y += 8;

  // Dados do funcionário
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(ml, y, cw, 16);
  doc.line(ml, y + 8, ml + cw, y + 8);

  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  doc.text("NOME DO FUNCIONÁRIO", ml + 3, y + 3);
  doc.text("CPF", ml + cw - 40, y + 3);
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text((employee.nome_completo || "").toUpperCase(), ml + 3, y + 6.5);
  doc.setFont("helvetica", "normal");
  doc.text(formatCPF(employee.cpf), ml + cw - 40, y + 6.5);
  doc.line(ml + cw - 45, y, ml + cw - 45, y + 8);

  const colW = cw / 4;
  const labels2 = ["CARGO", "ADMISSÃO", "SETOR", "PERÍODO"];
  const values2 = [employee.cargo || "-", formatDate(employee.data_admissao), employee.setor || "-", getMesAnoStr()];
  labels2.forEach((label, i) => {
    const x = ml + i * colW + 3;
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    doc.text(label, x, y + 11);
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(values2[i], x, y + 14.5);
    doc.setFont("helvetica", "normal");
    if (i > 0) doc.line(ml + i * colW, y + 8, ml + i * colW, y + 16);
  });
  y += 17;

  // Tabela eventos
  const tableBody = rows.map(r => [r.cod, r.desc, r.ref, r.prov, r.desc2]);
  autoTable(doc, {
    startY: y,
    head: [["Cód.", "Descrição", "Referência", "Proventos (R$)", "Descontos (R$)"]],
    body: tableBody,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 }, lineColor: [180, 180, 180], lineWidth: 0.3, textColor: [30, 30, 30], font: "helvetica" },
    headStyles: { fillColor: [33, 37, 41], textColor: [255, 255, 255], fontStyle: "bold", halign: "center", fontSize: 7.5 },
    columnStyles: { 0: { cellWidth: 16, halign: "center" }, 1: { cellWidth: cw * 0.40 }, 2: { cellWidth: 22, halign: "center" }, 3: { cellWidth: 30, halign: "right" }, 4: { cellWidth: 30, halign: "right" } },
    tableWidth: cw,
    margin: { left: ml },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 3 && data.cell.text[0]) {
        data.cell.styles.textColor = [21, 87, 36]; data.cell.styles.fontStyle = 'bold';
      }
      if (data.section === 'body' && data.column.index === 4 && data.cell.text[0]) {
        data.cell.styles.textColor = [153, 27, 27]; data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY;

  // Totais
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.setFillColor(240, 240, 240);
  doc.rect(ml, y, cw / 2, 7, "FD");
  doc.rect(ml + cw / 2, y, cw / 2, 7, "FD");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("TOTAL VENCIMENTOS", ml + 4, y + 4.5);
  doc.setTextColor(21, 87, 36);
  doc.text(`R$ ${formatCurrency(totalProventos)}`, ml + cw / 2 - 4, y + 4.5, { align: "right" });
  doc.setTextColor(30, 30, 30);
  doc.text("TOTAL DESCONTOS", ml + cw / 2 + 4, y + 4.5);
  doc.setTextColor(153, 27, 27);
  doc.text(`R$ ${formatCurrency(totalDescontos)}`, ml + cw - 4, y + 4.5, { align: "right" });
  y += 7;

  // Valor líquido
  doc.setFillColor(33, 37, 41);
  doc.rect(ml, y, cw, 8, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("VALOR LÍQUIDO:", ml + 6, y + 5.5);
  doc.setFontSize(12);
  doc.text(`R$ ${formatCurrency(pagamento.valor_liquido)}`, ml + cw - 6, y + 5.5, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 10;

  // Bases de cálculo
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text("BASES DE CÁLCULO", ml, y + 3);
  y += 4;

  const bLabels = ["Sal. Base", "Sal. Contr.", "INSS", "Base FGTS", "FGTS Mês", "Base IRRF", "Faixa IRRF"];
  const bValues = [
    formatCurrency(salarioBase.valor), formatCurrency(totalProventos), "0,00",
    formatCurrency(totalProventos), formatCurrency(fgts), "0,00", "-",
  ];
  autoTable(doc, {
    startY: y,
    head: [bLabels],
    body: [bValues],
    theme: "grid",
    styles: { fontSize: 6.5, cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 }, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: [50, 50, 50] },
    headStyles: { fillColor: [240, 240, 240], textColor: [80, 80, 80], fontStyle: "bold", halign: "center", fontSize: 6 },
    bodyStyles: { halign: "center" },
    tableWidth: cw,
    margin: { left: ml },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // Corte
  doc.setDrawColor(160, 160, 160);
  doc.setLineDashPattern([3, 2], 0);
  doc.setLineWidth(0.3);
  doc.line(ml, y, ml + cw, y);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(6);
  doc.setTextColor(160, 160, 160);
  doc.setFont("helvetica", "normal");
  doc.text("corte aqui", ml + cw / 2, y + 2.5, { align: "center" });
  y += 4;

  // Via empregador
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.text("VIA DO EMPREGADOR", ml + cw / 2, y + 3, { align: "center" });
  y += 5;

  doc.setFillColor(33, 37, 41);
  doc.rect(ml, y, cw, 7, "F");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text((empresa.nome || "").toUpperCase(), ml + 4, y + 4.5);
  doc.setFontSize(6.5);
  doc.text(`CNPJ: ${formatCNPJ(empresa.cnpj)}`, ml + cw - 4, y + 4.5, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 8;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(ml, y, cw, 9);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text((employee.nome_completo || "").toUpperCase(), ml + 3, y + 3.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(`CPF: ${formatCPF(employee.cpf)}  |  Cargo: ${employee.cargo || "-"}  |  Período: ${getMesAnoStr()}`, ml + 3, y + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(`Líquido: R$ ${formatCurrency(pagamento.valor_liquido)}`, ml + cw - 4, y + 5, { align: "right" });
  y += 10;

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text("Declaro ter recebido a importância líquida discriminada neste recibo.", ml + 3, y + 3);
  y += 7;

  doc.setDrawColor(100, 100, 100);
  if (assinatura) {
    // Assinatura embutida
    const sigW = cw / 2 - 13;
    const sigH = 16;
    try {
      doc.addImage(assinatura.assinatura_data_url, "PNG", ml + 3, y - 4, sigW, sigH);
    } catch (e) { console.error("sig img holerite", e); }
    doc.line(ml + 3, y + 12, ml + cw / 2 - 10, y + 12);
    doc.setFontSize(6);
    doc.setTextColor(21, 87, 36);
    doc.setFont("helvetica", "bold");
    doc.text("ASSINADO ELETRONICAMENTE", ml + 3, y + 15);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Protocolo: ${assinatura.protocolo}`, ml + 3, y + 18);
    doc.text(`Data: ${formatDateTime(assinatura.data_assinatura)}`, ml + 3, y + 21);

    // QR code à direita
    const qrSize = 22;
    const qrX = ml + cw - qrSize - 2;
    const qrY = y - 4;
    if (qrDataUrl) {
      try { doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize); } catch {}
    }
    doc.setFontSize(5.5);
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.text("Escaneie para validar", qrX + qrSize / 2, qrY + qrSize + 2.5, { align: "center" });
    doc.text("o certificado", qrX + qrSize / 2, qrY + qrSize + 5, { align: "center" });
    y += 22;
  } else {
    doc.line(ml + 3, y + 8, ml + cw / 2 - 10, y + 8);
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text("Assinatura do Funcionário", ml + 3, y + 11);
    doc.line(ml + cw / 2 + 10, y + 8, ml + cw - 3, y + 8);
    doc.text("Data: ____/____/________", ml + cw / 2 + 10, y + 11);
  }

  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.5);
  doc.rect(ml - 1, 10, cw + 2, y + 14 - 10);

  const nomeArquivo = `holerite-${employee.nome_completo.replace(/\s+/g, "-").toLowerCase()}-${MESES[pagamento.mes].toLowerCase()}-${pagamento.ano}.pdf`;
  const subpasta = `${pagamento.ano}-${String(pagamento.mes).padStart(2, "0")}`;

  if (options.returnBlob) {
    return doc.output("blob");
  }
  if (options.silent) {
    const blob: Blob = doc.output("blob");
    await backupPdfToDrive({
      tipo: "Holerites",
      nome_arquivo: nomeArquivo,
      pdfBlob: blob,
      employee_id: pagamento.employee_id,
      subpasta,
    });
  } else {
    saveAndBackup(doc, nomeArquivo, "Holerites", {
      employee_id: pagamento.employee_id,
      subpasta,
    });
  }
}

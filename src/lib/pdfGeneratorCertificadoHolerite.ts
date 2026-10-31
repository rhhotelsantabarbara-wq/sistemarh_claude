import jsPDF from "jspdf";
import QRCode from "qrcode";
import { dataBR } from "@/lib/date";

export interface CertificadoData {
  protocolo: string;
  hash_documento: string;
  hash_assinatura: string;
  nome_completo: string;
  cpf: string | null;
  matricula: string | null;
  empresa_nome: string;
  empresa_cnpj: string | null;
  periodo: string; // ex: "Janeiro/2026"
  data_assinatura: string; // ISO
  ip: string;
  user_agent: string;
  navegador: string | null;
  sistema_operacional: string | null;
  geo: { lat: number; lng: number } | null;
  geo_consentimento: boolean;
  selfie_data_url: string; // base64 data URL
  assinatura_data_url: string; // base64 data URL
  validacao_url: string; // URL pública para QR code
  eventos: { tipo: string; data: string; ip?: string }[];
}

function formatCpf(cpf: string | null) {
  if (!cpf) return "-";
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11) return cpf;
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}
function formatCnpj(cnpj: string | null) {
  if (!cnpj) return "-";
  const c = cnpj.replace(/\D/g, "");
  if (c.length !== 14) return cnpj;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}
function formatDateTime(iso: string) {
  const d = dataBR(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export async function gerarCertificadoPdf(data: CertificadoData): Promise<Blob> {
  const doc = new jsPDF({ format: "a4", orientation: "portrait" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 14;
  let y = m;

  // Header
  doc.setFillColor(31, 41, 55);
  doc.rect(0, 0, pw, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("CERTIFICADO DE ASSINATURA ELETRÔNICA", pw / 2, 10, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Holerite — Lei nº 14.063/2020 (assinatura eletrônica avançada)", pw / 2, 16, {
    align: "center",
  });
  doc.setTextColor(0, 0, 0);
  y = 28;

  // QR Code + protocolo bloco
  let qrUrl = "";
  try {
    qrUrl = await QRCode.toDataURL(data.validacao_url, { margin: 1, width: 256 });
  } catch (e) {
    console.error("QR generation failed", e);
  }
  if (qrUrl) {
    doc.addImage(qrUrl, "PNG", pw - m - 30, y, 30, 30);
  }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Protocolo Único:", m, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(data.protocolo, m, y + 11);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Data/Hora Oficial (Brasília):", m, y + 18);
  doc.setFont("helvetica", "normal");
  doc.text(formatDateTime(data.data_assinatura), m, y + 24);
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text("Escaneie o QR para validar este documento.", pw - m - 30, y + 33);
  doc.setTextColor(0, 0, 0);
  y += 36;

  // Signatário
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(m, y, pw - m, y);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("DADOS DO SIGNATÁRIO", m, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const sig = [
    ["Nome:", data.nome_completo],
    ["CPF:", formatCpf(data.cpf)],
    ["Matrícula:", data.matricula || "-"],
    ["Empresa:", data.empresa_nome],
    ["CNPJ:", formatCnpj(data.empresa_cnpj)],
    ["Período do Holerite:", data.periodo],
  ];
  sig.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.text(k, m, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(v), m + 40, y);
    y += 5;
  });
  y += 2;

  // Hashes
  doc.setDrawColor(200, 200, 200);
  doc.line(m, y, pw - m, y);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("INTEGRIDADE CRIPTOGRÁFICA", m, y);
  y += 5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Hash SHA-256 do Documento:", m, y);
  y += 4;
  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  const lines1 = doc.splitTextToSize(data.hash_documento, pw - 2 * m);
  doc.text(lines1, m, y);
  y += lines1.length * 3.2 + 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Hash SHA-256 da Assinatura (evidências):", m, y);
  y += 4;
  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  const lines2 = doc.splitTextToSize(data.hash_assinatura, pw - 2 * m);
  doc.text(lines2, m, y);
  y += lines2.length * 3.2 + 3;

  // Evidências técnicas
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("EVIDÊNCIAS TÉCNICAS", m, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const ev = [
    ["IP Público:", data.ip],
    ["Navegador:", data.navegador || "-"],
    ["Sistema Operacional:", data.sistema_operacional || "-"],
    [
      "Geolocalização:",
      data.geo_consentimento && data.geo
        ? `${data.geo.lat.toFixed(6)}, ${data.geo.lng.toFixed(6)}`
        : "não autorizada pelo signatário",
    ],
  ];
  ev.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.text(k, m, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(v), m + 45, y);
    y += 5;
  });
  y += 1;

  // User agent (pequeno)
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  const uaLines = doc.splitTextToSize(`User-Agent: ${data.user_agent}`, pw - 2 * m);
  doc.text(uaLines, m, y);
  y += uaLines.length * 3 + 4;
  doc.setTextColor(0, 0, 0);

  // Selfie + assinatura lado a lado
  const imgW = 55;
  const imgH = 55;
  if (y + imgH + 30 > ph) {
    doc.addPage();
    y = m;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PROVAS BIOMÉTRICAS", m, y);
  y += 5;
  try {
    doc.setDrawColor(180, 180, 180);
    doc.rect(m, y, imgW, imgH);
    doc.addImage(data.selfie_data_url, data.selfie_data_url.startsWith("data:image/png") ? "PNG" : "JPEG", m, y, imgW, imgH);
    doc.setFontSize(7);
    doc.text("Selfie capturada no ato", m, y + imgH + 4);
  } catch (e) {
    console.error("selfie img", e);
  }
  try {
    const sigX = m + imgW + 10;
    doc.setDrawColor(180, 180, 180);
    doc.rect(sigX, y, imgW + 20, imgH);
    doc.addImage(data.assinatura_data_url, data.assinatura_data_url.startsWith("data:image/jpeg") ? "JPEG" : "PNG", sigX + 2, y + 2, imgW + 16, imgH - 4);
    doc.setFontSize(7);
    doc.text("Assinatura manuscrita", sigX, y + imgH + 4);
  } catch (e) {
    console.error("sig img", e);
  }
  y += imgH + 10;

  // Eventos (auditoria)
  if (y + 30 > ph) {
    doc.addPage();
    y = m;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TRILHA DE AUDITORIA", m, y);
  y += 5;
  doc.setFontSize(8);
  data.eventos.forEach((ev) => {
    if (y > ph - 20) {
      doc.addPage();
      y = m;
    }
    doc.setFont("helvetica", "bold");
    doc.text(`• ${ev.tipo}`, m, y);
    doc.setFont("helvetica", "normal");
    doc.text(formatDateTime(ev.data), m + 60, y);
    if (ev.ip) doc.text(`IP: ${ev.ip}`, m + 115, y);
    y += 4.5;
  });
  y += 5;

  // Rodapé jurídico em todas as páginas
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(110, 110, 110);
    doc.setFont("helvetica", "italic");
    doc.text(
      "Documento assinado eletronicamente nos termos da Lei nº 14.063/2020 — Assinatura eletrônica avançada com prova biométrica (selfie), endereço IP, navegador e geolocalização (quando autorizada). Hash SHA-256 garante a integridade do documento.",
      m,
      ph - 8,
      { maxWidth: pw - 2 * m, align: "justify" },
    );
    doc.text(`Página ${i} de ${totalPages}`, pw - m, ph - 4, { align: "right" });
  }

  return doc.output("blob");
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

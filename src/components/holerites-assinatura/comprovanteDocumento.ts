// Comprovantes dos holerites em PDF assinados pelo colaborador (tabela holerite_documentos)
import { supabase } from "@/integrations/supabase/client";
import { gerarCertificadoPdf } from "@/lib/pdfGeneratorCertificadoHolerite";

const BUCKET = "holerites-assinados";
const MESES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const periodoDoc = (d: { mes: number; ano: number }) => `${MESES[d.mes]}/${d.ano}`;

/** Converte para data URL usando o tipo real do arquivo (alguns foram salvos com o tipo errado) */
const blobParaDataUrl = async (b: Blob) => {
  const bytes = new Uint8Array(await b.arrayBuffer());
  const tipo = bytes[0] === 0xff && bytes[1] === 0xd8 ? "image/jpeg" : bytes[0] === 0x89 && bytes[1] === 0x50 ? "image/png" : b.type || "image/jpeg";
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${tipo};base64,${btoa(bin)}`;
};

export async function baixarArquivo(path: string | null | undefined): Promise<Blob | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return data;
}

/** Link temporário para ver a foto/assinatura na tela */
export async function linksEvidencias(doc: any) {
  const paths = [doc.selfie_path, doc.assinatura_imagem_path].filter(Boolean);
  if (!paths.length) return {} as Record<string, string>;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 30);
  const m: Record<string, string> = {};
  (data || []).forEach((u: any) => { if (u.path && u.signedUrl) m[u.path] = u.signedUrl; });
  return m;
}

/** Gera o comprovante de assinatura (PDF) com selfie, assinatura, data, IP e códigos de verificação */
export async function gerarComprovanteDocumento(doc: any, emp: any, empresa: any): Promise<Blob> {
  const [selfie, assinatura] = await Promise.all([baixarArquivo(doc.selfie_path), baixarArquivo(doc.assinatura_imagem_path)]);
  const eventos: { tipo: string; data: string; ip?: string }[] = [];
  if (doc.created_at) eventos.push({ tipo: "Holerite disponibilizado", data: doc.created_at });
  if (doc.data_visualizacao) eventos.push({ tipo: "Holerite aberto pelo colaborador", data: doc.data_visualizacao, ip: doc.ip_publico || undefined });
  if (doc.data_assinatura) eventos.push({ tipo: "Assinatura registrada", data: doc.data_assinatura, ip: doc.ip_publico || undefined });
  return gerarCertificadoPdf({
    protocolo: doc.protocolo || "",
    hash_documento: doc.hash_documento || "",
    hash_assinatura: doc.hash_assinatura || "",
    nome_completo: emp?.nome_completo || "",
    cpf: emp?.cpf || null,
    matricula: emp?.codigo_funcionario || null,
    empresa_nome: empresa?.nome || "",
    empresa_cnpj: empresa?.cnpj || null,
    periodo: periodoDoc(doc),
    data_assinatura: doc.data_assinatura || doc.updated_at || new Date().toISOString(),
    ip: doc.ip_publico || "não registrado",
    user_agent: doc.user_agent || "",
    navegador: doc.navegador || null,
    sistema_operacional: doc.sistema_operacional || null,
    geo: doc.geo_consentimento && doc.geo_latitude != null && doc.geo_longitude != null ? { lat: Number(doc.geo_latitude), lng: Number(doc.geo_longitude) } : null,
    geo_consentimento: !!doc.geo_consentimento,
    selfie_data_url: selfie ? await blobParaDataUrl(selfie) : "",
    assinatura_data_url: assinatura ? await blobParaDataUrl(assinatura) : "",
    validacao_url: `${window.location.origin}/validar-holerite/${doc.protocolo || ""}`,
    eventos,
  });
}

export function salvarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const nomeArquivoSeguro = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);

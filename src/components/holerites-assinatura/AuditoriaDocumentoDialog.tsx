import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileCheck2, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { baixarArquivo, gerarComprovanteDocumento, linksEvidencias, nomeArquivoSeguro, periodoDoc, salvarBlob } from "./comprovanteDocumento";

interface Props {
  linha: any | null; // { doc, emp, empresa }
  onFechar: () => void;
}

const quando = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

/** Provas de uma assinatura de holerite em PDF: selfie, assinatura, data, IP, aparelho e códigos de verificação */
export function AuditoriaDocumentoDialog({ linha, onFechar }: Props) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [gerando, setGerando] = useState<"" | "comprovante" | "pdf">("");
  const doc = linha?.doc;

  useEffect(() => {
    setLinks({});
    if (doc) linksEvidencias(doc).then(setLinks);
  }, [doc]);

  if (!linha || !doc) return null;
  const nomeBase = `${nomeArquivoSeguro(linha.emp?.nome_completo || "colaborador")}_${String(doc.mes).padStart(2, "0")}-${doc.ano}`;

  const baixarComprovante = async () => {
    setGerando("comprovante");
    try {
      const blob = await gerarComprovanteDocumento(doc, linha.emp, linha.empresa);
      salvarBlob(blob, `comprovante_assinatura_${nomeBase}.pdf`);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o comprovante");
    } finally {
      setGerando("");
    }
  };
  const baixarPdf = async () => {
    setGerando("pdf");
    const blob = await baixarArquivo(doc.pdf_assinado_path);
    setGerando("");
    if (!blob) return toast.error("PDF assinado não encontrado");
    salvarBlob(blob, `holerite_assinado_${nomeBase}.pdf`);
  };

  const Item = ({ rotulo, valor, mono }: { rotulo: string; valor: React.ReactNode; mono?: boolean }) => (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{rotulo}</p>
      <p className={`mt-0.5 break-all text-sm ${mono ? "font-mono text-xs" : ""}`}>{valor || "—"}</p>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Comprovante de assinatura</DialogTitle>
          <DialogDescription>{linha.emp?.nome_completo} · holerite de {periodoDoc(doc)}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <figure className="space-y-1.5">
            <figcaption className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Selfie no momento da assinatura</figcaption>
            <div className="flex aspect-[3/4] max-h-72 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              {links[doc.selfie_path] ? <img src={links[doc.selfie_path]} alt="Selfie do colaborador" className="h-full w-full object-contain" /> : doc.selfie_path ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <span className="text-xs text-muted-foreground">Sem selfie</span>}
            </div>
          </figure>
          <figure className="space-y-1.5">
            <figcaption className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Assinatura</figcaption>
            <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg border bg-white">
              {links[doc.assinatura_imagem_path] ? <img src={links[doc.assinatura_imagem_path]} alt="Assinatura do colaborador" className="max-h-full max-w-full object-contain" /> : doc.assinatura_imagem_path ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <span className="text-xs text-muted-foreground">Sem assinatura</span>}
            </div>
          </figure>
        </div>

        <div className="grid gap-x-6 gap-y-4 rounded-lg bg-muted/50 p-4 sm:grid-cols-2">
          <Item rotulo="Protocolo" valor={doc.protocolo} mono />
          <Item rotulo="Assinado em" valor={quando(doc.data_assinatura)} />
          <Item rotulo="CPF" valor={linha.emp?.cpf} />
          <Item rotulo="Empresa" valor={linha.empresa?.nome} />
          <Item rotulo="IP" valor={doc.ip_publico} mono />
          <Item rotulo="Aparelho" valor={[doc.navegador, doc.sistema_operacional].filter(Boolean).join(" · ") || doc.user_agent} />
          <Item rotulo="Localização" valor={doc.geo_consentimento && doc.geo_latitude != null
            ? <a href={`https://www.google.com/maps?q=${doc.geo_latitude},${doc.geo_longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><MapPin className="h-3.5 w-3.5" />{Number(doc.geo_latitude).toFixed(5)}, {Number(doc.geo_longitude).toFixed(5)}</a>
            : "Não autorizada pelo colaborador"} />
          <Item rotulo="Holerite aberto em" valor={quando(doc.data_visualizacao)} />
          <div className="sm:col-span-2"><Item rotulo="Código do documento (SHA-256)" valor={doc.hash_documento} mono /></div>
          <div className="sm:col-span-2"><Item rotulo="Código da assinatura (SHA-256)" valor={doc.hash_assinatura} mono /></div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={baixarPdf} disabled={!!gerando}>
            {gerando === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Holerite assinado
          </Button>
          <Button onClick={baixarComprovante} disabled={!!gerando}>
            {gerando === "comprovante" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}Baixar comprovante (PDF)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AuditoriaDocumentoDialog;

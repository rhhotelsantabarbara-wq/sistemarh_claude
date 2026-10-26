import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dataBR } from "@/lib/date";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assinaturaId: string | null;
}

async function baixarArquivo(path: string, filename: string) {
  const { data, error } = await supabase.storage.from("holerites-assinados").download(path);
  if (error || !data) {
    alert("Não foi possível baixar o arquivo: " + (error?.message || "erro desconhecido"));
    return;
  }
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AuditoriaHoleriteDialog({ open, onOpenChange, assinaturaId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["auditoria-holerite", assinaturaId],
    enabled: open && !!assinaturaId,
    queryFn: async () => {
      const [{ data: a }, { data: eventos }] = await Promise.all([
        supabase
          .from("holerite_assinaturas")
          .select("*")
          .eq("id", assinaturaId!)
          .single(),
        supabase
          .from("holerite_eventos_auditoria")
          .select("*")
          .eq("assinatura_id", assinaturaId!)
          .order("created_at", { ascending: true }),
      ]);
      const urls: any = {};
      if (a?.selfie_path) {
        const { data: u } = await supabase.storage
          .from("holerites-assinados")
          .createSignedUrl(a.selfie_path, 600);
        urls.selfie = u?.signedUrl;
      }
      if (a?.assinatura_imagem_path) {
        const { data: u } = await supabase.storage
          .from("holerites-assinados")
          .createSignedUrl(a.assinatura_imagem_path, 600);
        urls.assinatura = u?.signedUrl;
      }
      if (a?.pdf_certificado_path) {
        const { data: u } = await supabase.storage
          .from("holerites-assinados")
          .createSignedUrl(a.pdf_certificado_path, 600);
        urls.certificado = u?.signedUrl;
      }
      if (a?.pdf_original_path) {
        const { data: u } = await supabase.storage
          .from("holerites-assinados")
          .createSignedUrl(a.pdf_original_path, 600);
        urls.original = u?.signedUrl;
      }
      return { a, eventos: eventos || [], urls };
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Auditoria da Assinatura</DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : !data.a ? (
          <p className="text-sm text-muted-foreground">Registro não encontrado.</p>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 bg-muted/30">
              <div>
                <div className="text-xs text-muted-foreground">Protocolo</div>
                <div className="font-mono">{data.a.protocolo}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="font-semibold">{data.a.status}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Signatário</div>
                <div>{data.a.nome_completo}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">CPF</div>
                <div>{data.a.cpf || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Data/Hora</div>
                <div>
                  {data.a.data_assinatura
                    ? dataBR(data.a.data_assinatura).toLocaleString("pt-BR")
                    : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">IP</div>
                <div>{data.a.ip_publico || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Navegador</div>
                <div>{data.a.navegador || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Sistema</div>
                <div>{data.a.sistema_operacional || "-"}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">Geolocalização</div>
                <div>
                  {data.a.geo_consentimento && data.a.geo_latitude
                    ? `${data.a.geo_latitude}, ${data.a.geo_longitude}`
                    : "Não autorizada"}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">Hash do Documento</div>
                <div className="font-mono text-xs break-all">{data.a.hash_documento}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">Hash da Assinatura</div>
                <div className="font-mono text-xs break-all">{data.a.hash_assinatura || "-"}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {data.urls.selfie && (
                <div className="border rounded p-2">
                  <div className="text-xs text-muted-foreground mb-1">Selfie</div>
                  <img src={data.urls.selfie} alt="selfie" className="w-full rounded" />
                </div>
              )}
              {data.urls.assinatura && (
                <div className="border rounded p-2">
                  <div className="text-xs text-muted-foreground mb-1">Assinatura</div>
                  <img src={data.urls.assinatura} alt="assinatura" className="w-full bg-white rounded" />
                </div>
              )}
            </div>

            <div>
              <h4 className="font-semibold mb-2">Trilha de Eventos</h4>
              <div className="space-y-1">
                {data.eventos.map((ev: any) => (
                  <div key={ev.id} className="flex justify-between text-xs border-b py-1">
                    <span className="font-medium">{ev.tipo_evento}</span>
                    <span>{dataBR(ev.created_at).toLocaleString("pt-BR")}</span>
                    <span className="text-muted-foreground">{ev.ip || "-"}</span>
                  </div>
                ))}
                {data.eventos.length === 0 && (
                  <p className="text-xs text-muted-foreground">Sem eventos registrados.</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {data.a.pdf_original_path && (
                <Button
                  variant="outline"
                  onClick={() => baixarArquivo(data.a.pdf_original_path, `holerite-${data.a.protocolo}.pdf`)}
                >
                  <Download className="w-4 h-4 mr-2" /> Holerite Original
                </Button>
              )}
              {data.a.pdf_certificado_path && (
                <Button
                  onClick={() => baixarArquivo(data.a.pdf_certificado_path, `certificado-${data.a.protocolo}.pdf`)}
                >
                  <Download className="w-4 h-4 mr-2" /> Certificado
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { dataBR } from "@/lib/date";

export default function ValidarHolerite() {
  const { protocolo } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!protocolo) return;
    fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/holerite-validar?protocolo=${encodeURIComponent(protocolo)}`,
      {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      },
    )
      .then((r) => r.json())
      .then((res) => {
        if (res.valido) setData(res);
        else setErro(res.erro || "Documento não encontrado");
      })
      .catch((e) => setErro(String(e)))
      .finally(() => setLoading(false));
  }, [protocolo]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-center">Validação de Holerite</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : erro || !data ? (
            <div className="text-center space-y-2 py-6">
              <XCircle className="w-12 h-12 text-destructive mx-auto" />
              <p className="font-semibold">Documento não validado</p>
              <p className="text-sm text-muted-foreground">{erro}</p>
              <p className="text-xs text-muted-foreground font-mono">{protocolo}</p>
            </div>
          ) : (
            <>
              <div className="text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
                <Badge className="bg-green-600">DOCUMENTO VÁLIDO</Badge>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Protocolo</dt>
                  <dd className="font-mono">{data.protocolo}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Data/Hora</dt>
                  <dd>{dataBR(data.data_assinatura).toLocaleString("pt-BR")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Empresa</dt>
                  <dd>{data.empresa}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">CNPJ</dt>
                  <dd>{data.cnpj}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Signatário</dt>
                  <dd>{data.signatario_nome}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">CPF</dt>
                  <dd>{data.signatario_cpf}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Período</dt>
                  <dd>{data.periodo}</dd>
                </div>
              </dl>
              <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-2">
                <div>
                  <div className="text-muted-foreground">Hash SHA-256 do Documento</div>
                  <div className="font-mono break-all">{data.hash_documento}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Hash da Assinatura</div>
                  <div className="font-mono break-all">{data.hash_assinatura}</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Documento assinado eletronicamente nos termos da Lei nº 14.063/2020.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

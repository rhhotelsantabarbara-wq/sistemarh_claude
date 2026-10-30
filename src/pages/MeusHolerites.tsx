import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileCheck2, PenLine, ArrowLeft, Download } from "lucide-react";
import { AssinaturaDocumentoHoleriteWizard } from "@/components/holerites-assinatura/AssinaturaDocumentoHoleriteWizard";
import { toast } from "sonner";

const MESES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const COMPETENCIA_INICIAL_COLABORADOR = "ano.gt.2026,and(ano.eq.2026,mes.gte.9)";

export default function MeusHolerites() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const colaboradorPreview = params.get("colaborador"); // RH vendo como o colaborador
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<any>(null);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [selectedDocumento, setSelectedDocumento] = useState<any>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    const { data: emp } = await supabase
      .from("employees")
      .select("*")
      .eq(colaboradorPreview ? "id" : "user_id", colaboradorPreview || user.id)
      .maybeSingle();
    if (!emp) {
      setLoading(false);
      return;
    }
    setEmployee(emp);
    const { data: docs } = await supabase
      .from("holerite_documentos" as any)
      .select("*")
      .eq("employee_id", emp.id)
      .or(COMPETENCIA_INICIAL_COLABORADOR)
      .order("ano", { ascending: false })
      .order("mes", { ascending: false });
    setDocumentos((docs as any[]) || []);
    setLoading(false);
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <h1 className="text-2xl font-bold">{colaboradorPreview && employee ? `Holerites de ${employee.nome_completo}` : "Meus Holerites"}</h1>
      </div>
      {colaboradorPreview && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Visualização do RH: você vê os holerites como o colaborador vê, mas não pode assinar por ele.
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !employee ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Nenhum cadastro de funcionário vinculado ao seu acesso.
          </CardContent>
        </Card>
      ) : (
        <>
          {documentos.filter((documento) => documento.status !== "assinado").length > 0 && (
            <Card className="border-orange-300 bg-orange-50/40">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><PenLine className="h-4 w-4 text-orange-600" /> PDFs pendentes de assinatura</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {documentos.filter((documento) => documento.status !== "assinado").map((documento) => (
                  <div key={documento.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
                    <div><div className="font-medium">{MESES[documento.mes]}/{documento.ano}</div><div className="text-sm text-muted-foreground">{documento.arquivo_nome}</div></div>
                    <Button disabled={!!colaboradorPreview} onClick={() => setSelectedDocumento(documento)}><PenLine className="mr-2 h-4 w-4" /> Assinar</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {documentos.some((documento) => documento.status === "assinado") && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileCheck2 className="h-4 w-4 text-green-600" /> PDFs assinados</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {documentos.filter((documento) => documento.status === "assinado").map((documento) => (
                  <div key={documento.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div><div className="flex items-center gap-2 font-medium">{MESES[documento.mes]}/{documento.ano}<Badge variant="secondary" className="bg-green-100 text-green-800">Assinado</Badge></div><div className="text-xs font-mono text-muted-foreground">{documento.protocolo}</div></div>
                    <Button variant="outline" onClick={async () => {
                      const path = documento.pdf_assinado_path || documento.arquivo_path;
                      const bucket = documento.pdf_assinado_path ? "holerites-assinados" : "holerites-importados";
                      const { data, error } = await supabase.storage.from(bucket).download(path);
                      if (error || !data) return toast.error("Não foi possível baixar o holerite");
                      const url = URL.createObjectURL(data);
                      const anchor = document.createElement("a");
                      anchor.href = url;
                      anchor.download = documento.arquivo_nome;
                      anchor.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}><Download className="mr-2 h-4 w-4" /> Baixar</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {documentos.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Nenhum holerite em PDF disponível a partir de setembro de 2026.
              </CardContent>
            </Card>
          )}
        </>
      )}

      {selectedDocumento && (
        <AssinaturaDocumentoHoleriteWizard
          open={!!selectedDocumento}
          onOpenChange={(open) => { if (!open) { setSelectedDocumento(null); load(); } }}
          documento={selectedDocumento}
          onSigned={load}
        />
      )}

    </div>
  );
}

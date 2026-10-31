import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Eye, ShieldCheck, FileWarning, Package, History } from "lucide-react";
import { toast } from "sonner";
import { AuditoriaDocumentoDialog } from "@/components/holerites-assinatura/AuditoriaDocumentoDialog";
import { baixarArquivo, gerarComprovanteDocumento, nomeArquivoSeguro, salvarBlob } from "@/components/holerites-assinatura/comprovanteDocumento";
import { dataBR } from "@/lib/date";
import { Indicador } from "@/components/layout/PageHeader";

interface Props {
  empresaIdInicial?: string;
}

export function AuditoriaHoleritesTab({ empresaIdInicial }: Props) {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [empresaId, setEmpresaId] = useState<string>(empresaIdInicial && empresaIdInicial !== "all" ? empresaIdInicial : "all");
  const [tipoContrato, setTipoContrato] = useState<string>("all");
  const [setor, setSetor] = useState<string>("all");
  const [statusFiltro, setStatusFiltro] = useState<string>("all");
  const [busca, setBusca] = useState("");
  const [exportando, setExportando] = useState(false);
  const [linhaAuditoria, setLinhaAuditoria] = useState<any | null>(null);
  const [showHistorico, setShowHistorico] = useState(false);

  const { data: empresas } = useQuery({
    queryKey: ["audit-empresas"],
    queryFn: async () => {
      const { data } = await supabase.from("empresas").select("id, nome").order("nome");
      return data || [];
    },
  });

  const { data: setores } = useQuery({
    queryKey: ["audit-setores"],
    queryFn: async () => {
      const { data } = await supabase.from("setores").select("id, nome").order("nome");
      return data || [];
    },
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["audit-holerites", mes, ano, empresaId, tipoContrato, setor, statusFiltro],
    queryFn: async () => {
      // Holerites em PDF importados para assinatura (holerite_documentos)
      let docQ = (supabase as any)
        .from("holerite_documentos")
        .select("*")
        .eq("mes", mes)
        .eq("ano", ano);
      if (empresaId !== "all") docQ = docQ.eq("empresa_id", empresaId);
      const { data: docs, error } = await docQ;
      if (error) throw error;
      if (!docs || docs.length === 0) return [];

      const empIds = [...new Set(docs.map((d: any) => d.employee_id))] as string[];
      const { data: emps } = await supabase
        .from("employees")
        .select("id, nome_completo, cpf, cargo, setor, tipo_contrato, codigo_funcionario")
        .in("id", empIds);
      const empMap = new Map((emps || []).map((e: any) => [e.id, e]));

      const empresaIds = [...new Set(docs.map((d: any) => d.empresa_id).filter(Boolean))] as string[];
      const { data: empresasD } = await supabase
        .from("empresas")
        .select("id, nome, cnpj")
        .in("id", empresaIds.length ? empresaIds : ["00000000-0000-0000-0000-000000000000"]);
      const empresaMap = new Map((empresasD || []).map((e: any) => [e.id, e]));

      let rows = docs.map((d: any) => {
        const e: any = empMap.get(d.employee_id) || {};
        const empresa: any = empresaMap.get(d.empresa_id) || null;
        const status = d.status === "assinado" ? "assinado" : d.data_visualizacao ? "visualizado" : "pendente";
        return {
          folha_id: d.id,
          assinatura_id: d.status === "assinado" ? d.id : null,
          doc: d,
          emp: e,
          empresaObj: empresa,
          funcionario: e.nome_completo || "—",
          cpf: e.cpf || "",
          empresa: empresa?.nome || "",
          contrato: e.tipo_contrato || "",
          setor: e.setor || "",
          status,
          protocolo: d.protocolo || "",
          data_assinatura: d.data_assinatura || null,
          ip: d.ip_publico || "",
        };
      });

      if (tipoContrato !== "all") rows = rows.filter((r) => r.contrato === tipoContrato);
      if (setor !== "all") {
        const nome = setores?.find((s) => s.id === setor)?.nome;
        if (nome) rows = rows.filter((r) => r.setor === nome);
      }
      if (statusFiltro !== "all") rows = rows.filter((r) => r.status === statusFiltro);

      return rows.sort((a, b) => a.funcionario.localeCompare(b.funcionario, "pt-BR"));
    },
  });

  const rowsFiltradas = useMemo(() => {
    const term = busca.trim().toLowerCase();
    if (!term) return data || [];
    return (data || []).filter(
      (r) => r.funcionario.toLowerCase().includes(term) || r.cpf.includes(term)
    );
  }, [data, busca]);

  const totais = useMemo(() => {
    const total = (data || []).length;
    const assinados = (data || []).filter((r) => r.status === "assinado").length;
    const visualizados = (data || []).filter((r) => r.status === "visualizado").length;
    const pendentes = (data || []).filter((r) => r.status === "pendente").length;
    const naoEnviados = (data || []).filter((r) => r.status === "nao_enviado").length;
    return {
      total,
      assinados,
      visualizados,
      pendentes,
      naoEnviados,
      perc: total > 0 ? Math.round((assinados / total) * 100) : 0,
    };
  }, [data]);

  const statusBadge = (s: string) => {
    if (s === "assinado") return <Badge className="bg-emerald-600 hover:bg-emerald-700">Assinado</Badge>;
    if (s === "visualizado") return <Badge variant="secondary">Visualizado</Badge>;
    if (s === "pendente") return <Badge variant="outline">Pendente</Badge>;
    return <Badge variant="destructive">Não enviado</Badge>;
  };

  // Pacote para fiscalização montado no navegador: holerite assinado + comprovante + selfie de cada um, e uma planilha geral
  const exportarPacote = async () => {
    const linhas = rowsFiltradas;
    if (!linhas.length) return;
    setExportando(true);
    const aviso = toast.loading("Montando o pacote…");
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const periodo = `${String(mes).padStart(2, "0")}-${ano}`;
      const csv = ["Colaborador;CPF;Empresa;Contrato;Setor;Situação;Protocolo;Assinado em;IP;Código do documento (SHA-256);Código da assinatura (SHA-256)"];
      let feitos = 0;
      const assinados = linhas.filter((r) => r.status === "assinado");
      for (const r of linhas) {
        csv.push([r.funcionario, r.cpf, r.empresa, r.contrato, r.setor, r.status, r.protocolo, r.data_assinatura ? new Date(r.data_assinatura).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "", r.ip, r.doc?.hash_documento || "", r.doc?.hash_assinatura || ""].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";"));
      }
      for (const r of assinados) {
        const pasta = zip.folder(`${nomeArquivoSeguro(r.funcionario)}_${nomeArquivoSeguro(r.cpf || r.folha_id.slice(0, 6))}`)!;
        const [pdf, selfie] = await Promise.all([baixarArquivo(r.doc.pdf_assinado_path), baixarArquivo(r.doc.selfie_path)]);
        if (pdf) pasta.file(`holerite_assinado_${periodo}.pdf`, pdf);
        if (selfie) pasta.file("selfie.jpg", selfie);
        try {
          pasta.file(`comprovante_assinatura_${periodo}.pdf`, await gerarComprovanteDocumento(r.doc, r.emp, r.empresaObj));
        } catch (e) { console.error("comprovante", r.funcionario, e); }
        feitos++;
        toast.loading(`Montando o pacote… ${feitos}/${assinados.length}`, { id: aviso });
      }
      zip.file("relatorio_assinaturas.csv", "\ufeff" + csv.join("\r\n"));
      const blob = await zip.generateAsync({ type: "blob" });
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))).map((b) => b.toString(16).padStart(2, "0")).join("");
      salvarBlob(blob, `fiscalizacao_holerites_${ano}${String(mes).padStart(2, "0")}.zip`);
      toast.success("Pacote gerado", { id: aviso, description: `${assinados.length} assinado(s) · código SHA-256 ${hash.slice(0, 16)}…` });
    } catch (e: any) {
      toast.error(e.message || "Erro ao montar o pacote", { id: aviso });
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Auditoria e fiscalização de holerites
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Painel para conferência e exportação de comprovantes assinados conforme Lei nº 14.063/2020 e CLT art. 464.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div>
              <Label className="text-xs">Mês</Label>
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {new Date(2000, m - 1).toLocaleString("pt-BR", { month: "long" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Ano</Label>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Empresa</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(empresas || []).map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Contrato</Label>
              <Select value={tipoContrato} onValueChange={setTipoContrato}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="fixo">Fixo</SelectItem>
                  <SelectItem value="intermitente">Intermitente</SelectItem>
                  <SelectItem value="prestador_servico">Prestador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Setor</Label>
              <Select value={setor} onValueChange={setSetor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {(setores || []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="assinado">Assinados</SelectItem>
                  <SelectItem value="visualizado">Visualizados</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Buscar funcionário / CPF</Label>
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite nome ou CPF..." />
            </div>
            <Button variant="outline" onClick={() => refetch()}>Atualizar</Button>
            <Button variant="outline" onClick={() => setShowHistorico(!showHistorico)}>
              <History className="w-4 h-4 mr-2" /> Histórico de Exportações
            </Button>
            <Button onClick={exportarPacote} disabled={exportando || (data || []).length === 0}>
              {exportando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Package className="w-4 h-4 mr-2" />}
              Baixar pacote de fiscalização (.zip)
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Total" value={totais.total} />
        <KpiCard label="Assinados" value={totais.assinados} accent="emerald" />
        <KpiCard label="Visualizados" value={totais.visualizados} />
        <KpiCard label="Pendentes" value={totais.pendentes} accent="amber" />
        <KpiCard label="Cobertura" value={`${totais.perc}%`} accent="indigo" />
      </div>

      {showHistorico && <HistoricoExportacoes />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Holerites — {String(mes).padStart(2, "0")}/{ano}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : rowsFiltradas.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground flex flex-col items-center gap-2">
              <FileWarning className="w-8 h-8" />
              Nenhum holerite em PDF importado neste mês.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsFiltradas.map((r) => (
                    <TableRow key={r.folha_id} className={r.status === "assinado" ? "cursor-pointer" : undefined} onClick={() => r.assinatura_id && setLinhaAuditoria({ doc: r.doc, emp: r.emp, empresa: r.empresaObj })}>
                      <TableCell className="font-medium">
                        {r.funcionario}
                        <div className="text-xs text-muted-foreground">{r.cpf}</div>
                      </TableCell>
                      <TableCell className="text-xs">{r.empresa}</TableCell>
                      <TableCell className="text-xs">{r.contrato}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.protocolo || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {r.data_assinatura ? dataBR(r.data_assinatura).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{r.ip || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!r.assinatura_id}
                          onClick={(e) => { e.stopPropagation(); setLinhaAuditoria({ doc: r.doc, emp: r.emp, empresa: r.empresaObj }); }}
                        >
                          <Eye className="w-4 h-4 mr-1" /> Comprovante
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AuditoriaDocumentoDialog linha={linhaAuditoria} onFechar={() => setLinhaAuditoria(null)} />
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: any; accent?: "emerald" | "amber" | "indigo" }) {
  const estilo: Record<string, [string, string]> = {
    emerald: ["border-l-emerald-500", "text-emerald-700"],
    amber: ["border-l-amber-400", "text-amber-700"],
    indigo: ["border-l-primary", "text-primary"],
  };
  const [faixa, cor] = accent ? estilo[accent] : ["border-l-slate-300", ""];
  return <Indicador rotulo={label} valor={value} faixa={faixa} cor={cor} />;
}

function HistoricoExportacoes() {
  const { data, isLoading } = useQuery({
    queryKey: ["historico-exportacoes-fiscalizacao"],
    queryFn: async () => {
      const { data } = await supabase
        .from("holerite_exportacoes_fiscalizacao")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-4 h-4" /> Histórico de Exportações (cadeia de custódia)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (data || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma exportação registrada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Qtd.</TableHead>
                <TableHead>Assinados</TableHead>
                <TableHead>Hash SHA-256</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data || []).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{dataBR(r.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-xs">
                    {r.nome_exportador}
                    <div className="text-muted-foreground">{r.email_exportador}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {String(r.filtros_aplicados?.mes || "?").padStart(2, "0")}/{r.filtros_aplicados?.ano || "?"}
                  </TableCell>
                  <TableCell className="text-xs">{r.quantidade_holerites}</TableCell>
                  <TableCell className="text-xs">{r.quantidade_assinados}</TableCell>
                  <TableCell className="font-mono text-xs">{(r.hash_pacote || "").slice(0, 16)}…</TableCell>
                  <TableCell className="text-xs">{r.ip || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

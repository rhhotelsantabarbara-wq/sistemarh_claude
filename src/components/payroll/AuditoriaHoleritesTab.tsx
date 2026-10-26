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
import { AuditoriaHoleriteDialog } from "@/components/holerites-assinatura/AuditoriaHoleriteDialog";
import { dataBR } from "@/lib/date";

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
  const [auditId, setAuditId] = useState<string | null>(null);
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
      let folhaQ = supabase
        .from("folha_pagamento")
        .select("id, employee_id, empresa_id, mes, ano, valor_bruto, valor_liquido, tipo_folha")
        .eq("mes", mes)
        .eq("ano", ano);
      if (empresaId !== "all") folhaQ = folhaQ.eq("empresa_id", empresaId);
      const { data: folhas } = await folhaQ;
      if (!folhas || folhas.length === 0) return [];

      const empIds = [...new Set(folhas.map((f) => f.employee_id))];
      const { data: emps } = await supabase
        .from("employees")
        .select("id, nome_completo, cpf, cargo, setor, tipo_contrato")
        .in("id", empIds);
      const empMap = new Map((emps || []).map((e: any) => [e.id, e]));

      const empresaIds = [...new Set(folhas.map((f) => f.empresa_id).filter(Boolean))] as string[];
      const { data: empresasD } = await supabase
        .from("empresas")
        .select("id, nome")
        .in("id", empresaIds.length ? empresaIds : ["00000000-0000-0000-0000-000000000000"]);
      const empresaMap = new Map((empresasD || []).map((e: any) => [e.id, e.nome]));

      const folhaIds = folhas.map((f) => f.id);
      const { data: assinaturas } = await supabase
        .from("holerite_assinaturas")
        .select("id, folha_pagamento_id, protocolo, status, data_assinatura, ip_publico")
        .in("folha_pagamento_id", folhaIds);
      const assMap = new Map((assinaturas || []).map((a: any) => [a.folha_pagamento_id, a]));

      let rows = folhas.map((f) => {
        const e: any = empMap.get(f.employee_id) || {};
        const a: any = assMap.get(f.id);
        return {
          folha_id: f.id,
          assinatura_id: a?.id || null,
          funcionario: e.nome_completo || "—",
          cpf: e.cpf || "",
          empresa: empresaMap.get(f.empresa_id) || "",
          contrato: e.tipo_contrato || "",
          setor: e.setor || "",
          status: a?.status || "nao_enviado",
          protocolo: a?.protocolo || "",
          data_assinatura: a?.data_assinatura || null,
          ip: a?.ip_publico || "",
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

  const exportarPacote = async () => {
    setExportando(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Sessão inválida");

      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/holerite-export-fiscalizacao`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          mes, ano,
          empresa_id: empresaId === "all" ? null : empresaId,
          tipo_contrato: tipoContrato === "all" ? null : tipoContrato,
          setor: setor === "all" ? null : setores?.find((s) => s.id === setor)?.nome,
          status: statusFiltro === "all" ? null : statusFiltro,
          incluir_holerites: true,
          incluir_certificados: true,
          incluir_selfies: true,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Falha ao gerar pacote" }));
        throw new Error(err.error || "Falha ao gerar pacote");
      }
      const hash = resp.headers.get("X-Hash-Pacote") || "";
      const blob = await resp.blob();
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = `fiscalizacao_${ano}${String(mes).padStart(2, "0")}.zip`;
      a.click();
      URL.revokeObjectURL(dlUrl);
      toast.success("Pacote gerado", {
        description: `Hash SHA-256: ${hash.slice(0, 16)}...`,
      });
    } catch (e: any) {
      toast.error(e.message || "Erro ao exportar");
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Auditoria & Fiscalização de Holerites
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
                  <SelectItem value="nao_enviado">Não enviados</SelectItem>
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
              Exportar Pacote de Fiscalização (.zip)
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
              Nenhum holerite encontrado.
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
                    <TableRow key={r.folha_id}>
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
                          onClick={() => setAuditId(r.assinatura_id)}
                        >
                          <Eye className="w-4 h-4 mr-1" /> Auditoria
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

      <AuditoriaHoleriteDialog
        open={!!auditId}
        onOpenChange={(o) => !o && setAuditId(null)}
        assinaturaId={auditId}
      />
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: any; accent?: "emerald" | "amber" | "indigo" }) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    indigo: "text-indigo-600",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${accent ? colors[accent] : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
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

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileCheck2,
  Download,
  ShieldCheck,
  FileSpreadsheet,
  History,
  Loader2,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { dataBR, todayISO, toISODateLocal } from "@/lib/date";

type Empresa = { id: string; nome: string; cnpj?: string | null };

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODateLocal(d);
};

export default function NR1AuditoriaMT() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("all");
  const [inicio, setInicio] = useState<string>(daysAgoISO(365));
  const [fim, setFim] = useState<string>(todayISO());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<"pdf" | "xlsx" | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  // dados consolidados
  const [riscos, setRiscos] = useState<any[]>([]);
  const [acoes, setAcoes] = useState<any[]>([]);
  const [treinamentos, setTreinamentos] = useState<any[]>([]);
  const [conclusoes, setConclusoes] = useState<any[]>([]);
  const [denuncias, setDenuncias] = useState<any[]>([]);
  const [clima, setClima] = useState<any[]>([]);
  const [liderancaResp, setLiderancaResp] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("empresas") as any)
        .select("id, nome, cnpj")
        .order("nome");
      setEmpresas(data || []);
    })();
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const { data } = await (supabase.from("nr1_auditoria_exports") as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory(data || []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const inicioISO = `${inicio}T00:00:00.000Z`;
      const fimISO = `${fim}T23:59:59.999Z`;
      const range = (q: any) =>
        q.gte("created_at", inicioISO).lte("created_at", fimISO);

      const [r, a, t, tc, d, c, lr] = await Promise.all([
        range((supabase.from("nr1_riscos") as any).select("*")),
        range((supabase.from("nr1_acoes_preventivas") as any).select("*")),
        (supabase.from("nr1_treinamentos") as any).select("*"),
        range((supabase.from("nr1_treinamento_conclusoes") as any).select("*")),
        range((supabase.from("nr1_denuncias") as any).select("*")),
        range((supabase.from("nr1_clima_respostas") as any).select("*")),
        range((supabase.from("nr1_lideranca_respostas") as any).select("*")),
      ]);

      setRiscos(r.data || []);
      setAcoes(a.data || []);
      setTreinamentos(t.data || []);
      setConclusoes(tc.data || []);
      setDenuncias(d.data || []);
      setClima(c.data || []);
      setLiderancaResp(lr.data || []);
      setLoading(false);
    })();
  }, [inicio, fim]);

  const empresaAtual = empresas.find((e) => e.id === empresaId);
  const kpis = useMemo(() => {
    const climaNotas: number[] = [];
    clima.forEach((r) =>
      (r.respostas || []).forEach(
        (x: any) => typeof x.valor === "number" && climaNotas.push(x.valor)
      )
    );
    const lidNotas: number[] = [];
    liderancaResp.forEach((r) =>
      (r.respostas || []).forEach(
        (x: any) => typeof x.valor === "number" && lidNotas.push(x.valor)
      )
    );
    const riscosAltos = riscos.filter(
      (r) => (r.probabilidade || 0) * (r.severidade || 0) >= 15
    ).length;
    const acoesConcluidas = acoes.filter((a) => a.status === "concluida").length;
    return {
      totalRiscos: riscos.length,
      riscosAltos,
      totalAcoes: acoes.length,
      acoesConcluidas,
      taxaConclusao: acoes.length
        ? Math.round((acoesConcluidas / acoes.length) * 100)
        : 0,
      totalTreinamentos: treinamentos.length,
      totalConclusoes: conclusoes.length,
      totalDenuncias: denuncias.length,
      denunciasConcluidas: denuncias.filter((d) => d.status === "concluida")
        .length,
      respondentesClima: clima.length,
      climaMedio: climaNotas.length
        ? +(climaNotas.reduce((a, b) => a + b, 0) / climaNotas.length).toFixed(2)
        : null,
      respondentesLideranca: liderancaResp.length,
      liderancaMedia: lidNotas.length
        ? +(lidNotas.reduce((a, b) => a + b, 0) / lidNotas.length).toFixed(2)
        : null,
    };
  }, [riscos, acoes, treinamentos, conclusoes, denuncias, clima, liderancaResp]);

  // agregados anonimizados
  const denunciasAgg = useMemo(() => {
    const cat: Record<string, number> = {};
    const stat: Record<string, number> = {};
    denuncias.forEach((d) => {
      cat[d.categoria || "Não informada"] =
        (cat[d.categoria || "Não informada"] || 0) + 1;
      stat[d.status || "aberta"] = (stat[d.status || "aberta"] || 0) + 1;
    });
    return { cat, stat };
  }, [denuncias]);

  const buildMetadata = () => ({
    empresa_id: empresaId === "all" ? null : empresaId,
    empresa_nome: empresaAtual?.nome || "Todas as empresas",
    cnpj: empresaAtual?.cnpj || null,
    periodo_inicio: inicio,
    periodo_fim: fim,
    kpis,
    gerado_em: new Date().toISOString(),
  });

  const registrarExport = async (
    formato: string,
    hash: string,
    metadata: any
  ) => {
    const { data: u } = await supabase.auth.getUser();
    await (supabase.from("nr1_auditoria_exports") as any).insert({
      empresa_id: empresaId === "all" ? null : empresaId,
      periodo_inicio: inicio,
      periodo_fim: fim,
      formato,
      hash_integridade: hash,
      gerado_por: u?.user?.id || null,
      metadata,
    });
    loadHistory();
  };

  const exportPDF = async () => {
    setGenerating("pdf");
    try {
      const metadata = buildMetadata();
      const hash = (await sha256(JSON.stringify(metadata))).slice(0, 32);

      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();

      // CAPA
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, pageW, 50, "F");
      doc.setTextColor(255);
      doc.setFontSize(22);
      doc.text("PACOTE DE AUDITORIA NR-1", pageW / 2, 22, { align: "center" });
      doc.setFontSize(11);
      doc.text("Riscos Psicossociais — Ministério do Trabalho", pageW / 2, 32, {
        align: "center",
      });
      doc.setFontSize(9);
      doc.text(
        "Conforme NR-1 — Disposições Gerais e Gerenciamento de Riscos",
        pageW / 2,
        40,
        { align: "center" }
      );

      doc.setTextColor(0);
      doc.setFontSize(11);
      let y = 70;
      const linha = (label: string, val: string) => {
        doc.setFont("helvetica", "bold");
        doc.text(label, 20, y);
        doc.setFont("helvetica", "normal");
        doc.text(val, 80, y);
        y += 8;
      };
      linha("Empresa:", empresaAtual?.nome || "Todas as empresas");
      linha("CNPJ:", empresaAtual?.cnpj || "—");
      linha("Período auditado:", `${inicio} a ${fim}`);
      linha("Data de emissão:", new Date().toLocaleString("pt-BR"));
      linha("Hash de integridade:", hash);

      // Sumário executivo
      doc.addPage();
      doc.setFontSize(16);
      doc.text("1. Sumário Executivo", 14, 18);
      autoTable(doc, {
        startY: 24,
        head: [["Indicador", "Valor"]],
        body: [
          ["Riscos psicossociais mapeados", String(kpis.totalRiscos)],
          ["Riscos de severidade alta (P×S ≥ 15)", String(kpis.riscosAltos)],
          ["Ações preventivas registradas", String(kpis.totalAcoes)],
          [
            "Ações concluídas",
            `${kpis.acoesConcluidas} (${kpis.taxaConclusao}%)`,
          ],
          ["Treinamentos NR-1 disponíveis", String(kpis.totalTreinamentos)],
          ["Conclusões de treinamento", String(kpis.totalConclusoes)],
          ["Denúncias recebidas (canal anônimo)", String(kpis.totalDenuncias)],
          ["Denúncias concluídas", String(kpis.denunciasConcluidas)],
          [
            "Pesquisas de clima respondidas",
            String(kpis.respondentesClima),
          ],
          [
            "Nota média de clima (1-5)",
            kpis.climaMedio === null ? "—" : String(kpis.climaMedio),
          ],
          [
            "Avaliações 360° de liderança respondidas",
            String(kpis.respondentesLideranca),
          ],
          [
            "Nota média de liderança (1-10)",
            kpis.liderancaMedia === null ? "—" : String(kpis.liderancaMedia),
          ],
        ],
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 10 },
      });

      // 2. Inventário de Riscos
      doc.addPage();
      doc.setFontSize(16);
      doc.text("2. Inventário de Riscos Psicossociais", 14, 18);
      autoTable(doc, {
        startY: 24,
        head: [["Categoria", "Descrição", "P", "S", "P×S", "Status"]],
        body: riscos.map((r) => [
          r.categoria || "—",
          (r.descricao || "").slice(0, 80),
          String(r.probabilidade ?? "—"),
          String(r.severidade ?? "—"),
          String((r.probabilidade || 0) * (r.severidade || 0)),
          r.status || "ativo",
        ]),
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 8 },
      });

      // 3. Plano de Ação
      doc.addPage();
      doc.setFontSize(16);
      doc.text("3. Plano de Ação Preventivo", 14, 18);
      autoTable(doc, {
        startY: 24,
        head: [["Título", "Responsável", "Prazo", "Status"]],
        body: acoes.map((a) => [
          (a.titulo || "—").slice(0, 60),
          a.responsavel || "—",
          a.prazo || "—",
          a.status || "pendente",
        ]),
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 8 },
      });

      // 4. Treinamentos
      doc.addPage();
      doc.setFontSize(16);
      doc.text("4. Registro de Treinamentos NR-1", 14, 18);
      autoTable(doc, {
        startY: 24,
        head: [["Treinamento", "Conclusões no período"]],
        body: treinamentos.map((t) => {
          const cn = conclusoes.filter((c) => c.treinamento_id === t.id).length;
          return [t.titulo || "—", String(cn)];
        }),
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 9 },
      });

      // 5. Denúncias agregadas (anônimas)
      doc.addPage();
      doc.setFontSize(16);
      doc.text("5. Canal de Denúncias (dados agregados)", 14, 18);
      doc.setFontSize(9);
      doc.text(
        "Anonimato preservado — apenas estatísticas agregadas conforme política do canal.",
        14,
        25
      );
      autoTable(doc, {
        startY: 30,
        head: [["Categoria", "Quantidade"]],
        body: Object.entries(denunciasAgg.cat).map(([k, v]) => [k, String(v)]),
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 9 },
      });
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: [["Status", "Quantidade"]],
        body: Object.entries(denunciasAgg.stat).map(([k, v]) => [k, String(v)]),
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 9 },
      });

      // 6. Clima e 7. Liderança (agregados)
      doc.addPage();
      doc.setFontSize(16);
      doc.text("6. Pesquisa de Clima e 7. Avaliação de Liderança", 14, 18);
      autoTable(doc, {
        startY: 24,
        head: [["Métrica", "Valor"]],
        body: [
          ["Respondentes — Clima", String(kpis.respondentesClima)],
          [
            "Nota média Clima (1-5)",
            kpis.climaMedio === null ? "—" : String(kpis.climaMedio),
          ],
          ["Respondentes — Liderança", String(kpis.respondentesLideranca)],
          [
            "Nota média Liderança (1-10)",
            kpis.liderancaMedia === null ? "—" : String(kpis.liderancaMedia),
          ],
        ],
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 10 },
      });

      // Assinatura + rodapé com hash em todas as páginas
      const total = doc.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          `Hash: ${hash}  •  Página ${i} de ${total}  •  ${empresaAtual?.nome || "Todas as empresas"}`,
          pageW / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: "center" }
        );
      }

      // Página de assinatura
      doc.addPage();
      doc.setTextColor(0);
      doc.setFontSize(14);
      const filename = `auditoria-nr1-${inicio}_a_${fim}.pdf`;
      doc.save(filename);
      await registrarExport("pdf", hash, metadata);
      toast.success("Pacote de auditoria PDF gerado!");
    } catch (e: any) {
      toast.error("Erro ao gerar PDF: " + (e.message || ""));
    } finally {
      setGenerating(null);
    }
  };

  const exportExcel = async () => {
    setGenerating("xlsx");
    try {
      const metadata = buildMetadata();
      const hash = (await sha256(JSON.stringify(metadata))).slice(0, 32);

      const wb = XLSX.utils.book_new();

      const capa = [
        ["PACOTE DE AUDITORIA NR-1"],
        ["Empresa", empresaAtual?.nome || "Todas as empresas"],
        ["CNPJ", empresaAtual?.cnpj || "—"],
        ["Período", `${inicio} a ${fim}`],
        ["Gerado em", new Date().toLocaleString("pt-BR")],
        ["Hash de integridade", hash],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(capa), "Capa");

      const resumo = [
        ["Indicador", "Valor"],
        ["Riscos mapeados", kpis.totalRiscos],
        ["Riscos altos (P×S ≥ 15)", kpis.riscosAltos],
        ["Ações registradas", kpis.totalAcoes],
        ["Ações concluídas", kpis.acoesConcluidas],
        ["Taxa de conclusão (%)", kpis.taxaConclusao],
        ["Treinamentos", kpis.totalTreinamentos],
        ["Conclusões de treinamento", kpis.totalConclusoes],
        ["Denúncias recebidas", kpis.totalDenuncias],
        ["Denúncias concluídas", kpis.denunciasConcluidas],
        ["Respondentes clima", kpis.respondentesClima],
        ["Nota média clima (1-5)", kpis.climaMedio ?? ""],
        ["Respondentes liderança", kpis.respondentesLideranca],
        ["Nota média liderança (1-10)", kpis.liderancaMedia ?? ""],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ["Categoria", "Descrição", "Probabilidade", "Severidade", "P×S", "Status", "Criado em"],
          ...riscos.map((r) => [
            r.categoria,
            r.descricao,
            r.probabilidade,
            r.severidade,
            (r.probabilidade || 0) * (r.severidade || 0),
            r.status,
            r.created_at,
          ]),
        ]),
        "Riscos"
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ["Título", "Descrição", "Responsável", "Prazo", "Status", "Criado em"],
          ...acoes.map((a) => [
            a.titulo,
            a.descricao,
            a.responsavel,
            a.prazo,
            a.status,
            a.created_at,
          ]),
        ]),
        "Ações"
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ["Treinamento", "Conclusões"],
          ...treinamentos.map((t) => [
            t.titulo,
            conclusoes.filter((c) => c.treinamento_id === t.id).length,
          ]),
        ]),
        "Treinamentos"
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ["Categoria", "Quantidade"],
          ...Object.entries(denunciasAgg.cat),
          [],
          ["Status", "Quantidade"],
          ...Object.entries(denunciasAgg.stat),
        ]),
        "Denúncias (agregado)"
      );

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ["Métrica", "Valor"],
          ["Respondentes clima", kpis.respondentesClima],
          ["Nota média clima", kpis.climaMedio ?? ""],
          ["Respondentes liderança", kpis.respondentesLideranca],
          ["Nota média liderança", kpis.liderancaMedia ?? ""],
        ]),
        "Clima e Liderança"
      );

      const filename = `auditoria-nr1-${inicio}_a_${fim}.xlsx`;
      XLSX.writeFile(wb, filename);
      await registrarExport("xlsx", hash, metadata);
      toast.success("Pacote Excel de auditoria gerado!");
    } catch (e: any) {
      toast.error("Erro ao gerar Excel: " + (e.message || ""));
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-primary" />
            Auditoria — Ministério do Trabalho
          </h1>
          <p className="text-muted-foreground mt-1">
            Pacote oficial NR-1 para fiscalização, com hash de integridade e
            registro de emissão.
          </p>
        </div>
      </div>

      <Card className="p-5 shadow-elegant space-y-4">
        <h2 className="font-semibold text-lg">Parâmetros da Auditoria</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data de início</Label>
            <Input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Data de fim</Label>
            <Input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
          </div>
          <div className="space-y-2 flex flex-col justify-end">
            <Label>&nbsp;</Label>
            <div className="flex gap-2">
              <Button
                onClick={exportPDF}
                disabled={generating !== null || loading}
                className="flex-1"
              >
                {generating === "pdf" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                PDF Oficial
              </Button>
              <Button
                onClick={exportExcel}
                disabled={generating !== null || loading}
                variant="outline"
                className="flex-1"
              >
                {generating === "xlsx" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                )}
                Excel
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 shadow-elegant">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <FileCheck2 className="w-5 h-5" /> Pré-visualização do Pacote
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando dados…</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Riscos mapeados" value={kpis.totalRiscos} />
            <Stat
              label="Riscos altos"
              value={kpis.riscosAltos}
              tone={kpis.riscosAltos > 0 ? "danger" : "ok"}
            />
            <Stat label="Ações registradas" value={kpis.totalAcoes} />
            <Stat
              label="Taxa de conclusão"
              value={`${kpis.taxaConclusao}%`}
            />
            <Stat
              label="Treinamentos NR-1"
              value={kpis.totalTreinamentos}
              sub={`${kpis.totalConclusoes} conclusões`}
            />
            <Stat
              label="Denúncias"
              value={kpis.totalDenuncias}
              sub={`${kpis.denunciasConcluidas} concluídas`}
            />
            <Stat
              label="Clima (1-5)"
              value={kpis.climaMedio ?? "—"}
              sub={`${kpis.respondentesClima} respondentes`}
            />
            <Stat
              label="Liderança (1-10)"
              value={kpis.liderancaMedia ?? "—"}
              sub={`${kpis.respondentesLideranca} respondentes`}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-4">
          O pacote inclui: capa institucional, sumário executivo, inventário de
          riscos, plano de ação, registro de treinamentos, estatísticas
          agregadas de denúncias (100% anônimas), pesquisa de clima, avaliação
          de liderança, declaração de conformidade e hash SHA-256 em todas as
          páginas.
        </p>
      </Card>

      <Card className="p-5 shadow-elegant">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <History className="w-5 h-5" /> Histórico de Exportações
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma exportação registrada ainda.
          </p>
        ) : (
          <Table>
              <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>
                    {dataBR(h.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    {h.periodo_inicio} a {h.periodo_fim}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {(h.formato || "").toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {h.hash_integridade}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: any;
  sub?: string;
  tone?: "ok" | "danger";
}) {
  return (
    <div className="border rounded-lg p-3 bg-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-xl font-bold ${
          tone === "danger" ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

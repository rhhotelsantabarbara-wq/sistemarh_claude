// Relatório configurável usado pela Central de Relatórios: escolha do tipo, agrupamento,
// período e busca; resumo por grupo; uma tabela por grupo; PDF (relatorioPdf) e Excel.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search } from "lucide-react";
import * as XLSX from "xlsx";
import ExportButtons from "./ExportButtons";
import { gerarRelatorioPdf } from "@/lib/relatorioPdf";

export interface ColunaRel {
  titulo: string;
  valor: (r: any) => string | number | null | undefined;
  largura?: number; // mm no PDF
  alinhar?: "direita";
  destaque?: boolean;
}

export interface AgrupamentoRel {
  chave: string;
  rotulo: string; // "Setor"
  valor: (r: any) => string;
  ordem?: "quantidade" | "alfabetica" | "cronologica";
  chaveOrdem?: (r: any) => string; // para ordem cronológica (ex.: "2026-11")
}

export interface TipoRel {
  chave: string;
  nome: string; // no seletor
  titulo: string; // no PDF
  buscar: () => Promise<any[]>;
  colunas: ColunaRel[];
  agrupamentos: AgrupamentoRel[]; // o primeiro é o padrão
  campoData?: (r: any) => string | null | undefined; // habilita filtro de período (AAAA-MM-DD)
  textoBusca: (r: any) => string;
  ordenar?: (a: any, b: any) => number;
  vazio?: string;
}

const SEM_GRUPO = "__nenhum";
const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function RelatorioConfiguravel({ tipos, titulo }: { tipos: TipoRel[]; titulo: string }) {
  const [tipoChave, setTipoChave] = useState(tipos[0].chave);
  const tipo = tipos.find((t) => t.chave === tipoChave)!;
  const [agrupar, setAgrupar] = useState(tipos[0].agrupamentos[0]?.chave || SEM_GRUPO);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [busca, setBusca] = useState("");

  const trocarTipo = (c: string) => {
    setTipoChave(c);
    const t = tipos.find((x) => x.chave === c)!;
    setAgrupar(t.agrupamentos[0]?.chave || SEM_GRUPO);
  };

  const { data, isLoading } = useQuery({ queryKey: ["relatorio", tipoChave], queryFn: tipo.buscar });

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    let lista = (data || []).filter((r) => !t || tipo.textoBusca(r).toLowerCase().includes(t));
    if (tipo.campoData && (de || ate)) {
      lista = lista.filter((r) => {
        const d = (tipo.campoData!(r) || "").slice(0, 10);
        if (!d) return false;
        return (!de || d >= de) && (!ate || d <= ate);
      });
    }
    return tipo.ordenar ? [...lista].sort(tipo.ordenar) : lista;
  }, [data, busca, de, ate, tipo]);

  const grupoDef = tipo.agrupamentos.find((a) => a.chave === agrupar);
  const grupos = useMemo(() => {
    if (!grupoDef) return [{ titulo: "", lista: filtrados }];
    const mapa = new Map<string, any[]>();
    const ordemDe = new Map<string, string>();
    for (const r of filtrados) {
      const k = grupoDef.valor(r) || "—";
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push(r);
      if (grupoDef.chaveOrdem) ordemDe.set(k, grupoDef.chaveOrdem(r));
    }
    const arr = Array.from(mapa.entries()).map(([titulo, lista]) => ({ titulo, lista }));
    if (grupoDef.ordem === "cronologica") return arr.sort((a, b) => (ordemDe.get(b.titulo) || "").localeCompare(ordemDe.get(a.titulo) || ""));
    return grupoDef.ordem === "alfabetica"
      ? arr.sort((a, b) => a.titulo.localeCompare(b.titulo))
      : arr.sort((a, b) => b.lista.length - a.lista.length || a.titulo.localeCompare(b.titulo));
  }, [filtrados, grupoDef]);

  const maior = Math.max(1, ...grupos.map((g) => g.lista.length));
  const fmt = (v: any) => (v === null || v === undefined || v === "" ? "—" : String(v));
  const br = (iso: string) => iso.split("-").reverse().join("/");

  const filtrosTexto = () => {
    const f: string[] = [];
    if (de || ate) f.push(`Período: ${de ? br(de) : "início"} a ${ate ? br(ate) : "hoje"}`);
    if (busca.trim()) f.push(`Busca: "${busca.trim()}"`);
    if (grupoDef) f.push(`Agrupado por ${grupoDef.rotulo.toLowerCase()}`);
    return f;
  };

  const exportarPdf = () => {
    gerarRelatorioPdf({
      titulo: tipo.titulo,
      filtros: filtrosTexto(),
      colunas: tipo.colunas.map((c) => c.titulo),
      larguras: Object.fromEntries(tipo.colunas.map((c, i) => [i, c.largura]).filter(([, w]) => w)),
      grupos: grupos.map((g) => ({ titulo: g.titulo, linhas: g.lista.map((r) => tipo.colunas.map((c) => fmt(c.valor(r)))) })),
      rotuloGrupo: grupoDef?.rotulo,
      paisagem: tipo.colunas.length > 4,
      nomeArquivo: `${tipo.titulo.toLowerCase().replace(/\s+/g, "-")}-${hojeISO()}.pdf`,
    });
  };

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    const linhas = grupos.flatMap((g) =>
      g.lista.map((r) => ({
        ...(grupoDef ? { [grupoDef.rotulo]: g.titulo } : {}),
        ...Object.fromEntries(tipo.colunas.map((c) => [c.titulo, c.valor(r) ?? ""])),
      })),
    );
    const ws = XLSX.utils.json_to_sheet(linhas);
    ws["!cols"] = Object.keys(linhas[0] || {}).map((k, i) => ({ wch: i <= 1 ? 36 : 18 }));
    XLSX.utils.book_append_sheet(wb, ws, tipo.nome.slice(0, 30));
    if (grupoDef) {
      const resumo: any[] = grupos.map((g) => ({ [grupoDef.rotulo]: g.titulo, Quantidade: g.lista.length }));
      resumo.push({ [grupoDef.rotulo]: "Total", Quantidade: filtrados.length });
      const wr = XLSX.utils.json_to_sheet(resumo);
      wr["!cols"] = [{ wch: 36 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wr, "Resumo");
    }
    XLSX.writeFile(wb, `${tipo.titulo.toLowerCase().replace(/\s+/g, "-")}-${hojeISO()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{titulo}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tipos.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor={`rel-tipo-${titulo}`}>Relatório</Label>
                <Select value={tipoChave} onValueChange={trocarTipo}>
                  <SelectTrigger id={`rel-tipo-${titulo}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tipos.map((t) => <SelectItem key={t.chave} value={t.chave}>{t.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={`rel-agrupar-${titulo}`}>Agrupar por</Label>
              <Select value={agrupar} onValueChange={setAgrupar}>
                <SelectTrigger id={`rel-agrupar-${titulo}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tipo.agrupamentos.map((a) => <SelectItem key={a.chave} value={a.chave}>{a.rotulo}</SelectItem>)}
                  <SelectItem value={SEM_GRUPO}>Não agrupar (lista única)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`rel-busca-${titulo}`}>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id={`rel-busca-${titulo}`} className="pl-9" placeholder="Nome, item, motivo…" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
            </div>
            {tipo.campoData && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`rel-de-${titulo}`}>De</Label>
                  <Input id={`rel-de-${titulo}`} type="date" value={de} onChange={(e) => setDe(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`rel-ate-${titulo}`}>Até</Label>
                  <Input id={`rel-ate-${titulo}`} type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{filtrados.length}</strong> registros
              {grupoDef && <> em <strong className="text-foreground">{grupos.length}</strong> {grupos.length === 1 ? "grupo" : "grupos"}</>}
            </p>
            <ExportButtons onExportPDF={exportarPdf} onExportExcel={exportarExcel} disabled={filtrados.length === 0} />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : filtrados.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{tipo.vazio || "Nenhum registro com esses filtros."}</CardContent></Card>
      ) : (
        <>
          {grupoDef && grupos.length > 1 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Resumo por {grupoDef.rotulo.toLowerCase()}</CardTitle></CardHeader>
              <CardContent>
                <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {grupos.map((g) => (
                    <li key={g.titulo}>
                      <a href={`#rel-${tipoChave}-${encodeURIComponent(g.titulo)}`} className="block rounded-md p-1 hover:bg-muted/60">
                        <div className="flex justify-between gap-3 text-sm">
                          <span className="truncate font-medium">{g.titulo}</span>
                          <span className="tabular-nums text-muted-foreground">{g.lista.length} · {((g.lista.length / filtrados.length) * 100).toFixed(0)}%</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(g.lista.length / maior) * 100}%` }} />
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {grupos.map((g) => (
            <Card key={g.titulo || "todos"} id={`rel-${tipoChave}-${encodeURIComponent(g.titulo)}`} className="scroll-mt-24 overflow-hidden">
              {grupoDef && (
                <div className="flex items-baseline justify-between gap-3 border-b bg-muted/40 px-4 py-3">
                  <h3 className="font-semibold">{g.titulo}</h3>
                  <span className="text-sm text-muted-foreground">{g.lista.length} {g.lista.length === 1 ? "registro" : "registros"}</span>
                </div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-right">#</TableHead>
                      {tipo.colunas.map((c) => <TableHead key={c.titulo} className={c.alinhar === "direita" ? "text-right" : ""}>{c.titulo}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.lista.map((r, i) => (
                      <TableRow key={r.id || i}>
                        <TableCell className="py-2 text-right tabular-nums text-muted-foreground">{i + 1}</TableCell>
                        {tipo.colunas.map((c) => (
                          <TableCell key={c.titulo} className={`py-2 ${c.destaque ? "font-medium" : ""} ${c.alinhar === "direita" ? "text-right tabular-nums" : ""}`}>{fmt(c.valor(r))}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

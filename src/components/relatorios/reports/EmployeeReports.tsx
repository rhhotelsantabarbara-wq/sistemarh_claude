import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ExportButtons from "../ExportButtons";
import * as XLSX from "xlsx";
import { Loader2, Search } from "lucide-react";
import { formatDateOnlyPtBR } from "@/lib/date";
import { gerarRelatorioPdf } from "@/lib/relatorioPdf";

const STATUS: Record<string, string> = {
  ativo: "Ativo",
  ferias: "Férias",
  afastado: "Afastado",
  em_admissao: "Em admissão",
  demitido: "Demitido",
};
const CONTRATO: Record<string, string> = {
  fixo: "Fixo (CLT)",
  intermitente: "Intermitente",
  prestador_servico: "Prestador de serviço",
};
const AGRUPAR: Record<string, { rotulo: string; titulo: string; valor: (e: any) => string }> = {
  sector: { rotulo: "Setor", titulo: "Colaboradores por Setor", valor: (e) => e.setor || "Sem setor" },
  company: { rotulo: "Empresa", titulo: "Colaboradores por Empresa", valor: (e) => e.empresas?.nome || "Sem empresa" },
  cargo: { rotulo: "Cargo", titulo: "Colaboradores por Cargo", valor: (e) => e.cargo || "Sem cargo" },
  status: { rotulo: "Situação", titulo: "Colaboradores por Situação", valor: (e) => STATUS[e.status] || e.status || "—" },
  contract: { rotulo: "Contrato", titulo: "Colaboradores por Tipo de Contrato", valor: (e) => CONTRATO[e.tipo_contrato] || e.tipo_contrato || "—" },
  gender: { rotulo: "Sexo", titulo: "Colaboradores por Sexo", valor: (e) => e.sexo || "Não informado" },
  all: { rotulo: "", titulo: "Lista de Colaboradores", valor: () => "" },
};

const nomeBonito = (s: string) => (s || "").toLowerCase().replace(/(^|\s)(\p{L})/gu, (m) => m.toUpperCase()).replace(/\s(De|Da|Do|Das|Dos|E)\s/g, (m) => m.toLowerCase());

const EmployeeReports = () => {
  const [agrupar, setAgrupar] = useState("sector");
  const [empresa, setEmpresa] = useState("all");
  const [setor, setSetor] = useState("all");
  const [contrato, setContrato] = useState("all");
  const [status, setStatus] = useState("ativos");
  const [sexo, setSexo] = useState("all");
  const [busca, setBusca] = useState("");

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: sectors } = useQuery({
    queryKey: ["sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("setores").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees-report", empresa, setor, contrato, status, sexo],
    queryFn: async () => {
      let q = supabase.from("employees").select("*, empresas(nome)");
      if (empresa !== "all") q = q.eq("empresa_id", empresa);
      if (setor !== "all") q = q.eq("setor", setor);
      if (contrato !== "all") q = q.eq("tipo_contrato", contrato as any);
      if (status === "ativos") q = q.neq("status", "demitido" as any);
      else if (status !== "all") q = q.eq("status", status as any);
      if (sexo !== "all") q = q.eq("sexo", sexo);
      const { data, error } = await q.order("nome_completo");
      if (error) throw error;
      return data;
    },
  });

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (employees || []).filter((e: any) => !t || e.nome_completo?.toLowerCase().includes(t) || e.cargo?.toLowerCase().includes(t));
  }, [employees, busca]);

  // Grupos ordenados do maior para o menor; nomes em ordem alfabética dentro de cada grupo
  const grupos = useMemo(() => {
    const def = AGRUPAR[agrupar];
    const mapa = new Map<string, any[]>();
    for (const e of filtrados) {
      const k = def.valor(e);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push(e);
    }
    return Array.from(mapa.entries())
      .map(([titulo, lista]) => ({ titulo, lista: lista.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo)) }))
      .sort((a, b) => b.lista.length - a.lista.length || a.titulo.localeCompare(b.titulo));
  }, [filtrados, agrupar]);

  const def = AGRUPAR[agrupar];
  const maior = Math.max(1, ...grupos.map((g) => g.lista.length));

  // Colunas: a que está sendo usada para agrupar sai da tabela
  const colunas = [
    { chave: "nome", titulo: "Nome", valor: (e: any) => nomeBonito(e.nome_completo), largura: 62 },
    { chave: "cargo", titulo: "Cargo", valor: (e: any) => nomeBonito(e.cargo || ""), largura: 46 },
    { chave: "sector", titulo: "Setor", valor: (e: any) => e.setor || "—", largura: 32 },
    { chave: "company", titulo: "Empresa", valor: (e: any) => (e.empresas?.nome || "—").replace("EMPREENDIMENTOS TURISTICOS ", "").replace(" OPERADORA DE HOTEIS LTDA", ""), largura: 30 },
    { chave: "admissao", titulo: "Admissão", valor: (e: any) => formatDateOnlyPtBR(e.data_admissao) || "—", largura: 22 },
    { chave: "contract", titulo: "Contrato", valor: (e: any) => CONTRATO[e.tipo_contrato] || "—", largura: 28 },
    { chave: "status", titulo: "Situação", valor: (e: any) => STATUS[e.status] || e.status || "—", largura: 22 },
  ].filter((c) => c.chave !== agrupar);

  const filtrosTexto = () => {
    const f: string[] = [];
    f.push(`Situação: ${status === "ativos" ? "ativos (sem demitidos)" : status === "all" ? "todas" : STATUS[status]}`);
    if (empresa !== "all") f.push(`Empresa: ${companies?.find((c) => c.id === empresa)?.nome}`);
    if (setor !== "all") f.push(`Setor: ${setor}`);
    if (contrato !== "all") f.push(`Contrato: ${CONTRATO[contrato]}`);
    if (sexo !== "all") f.push(`Sexo: ${sexo}`);
    if (busca.trim()) f.push(`Busca: "${busca.trim()}"`);
    return f;
  };

  const exportToPDF = () => {
    gerarRelatorioPdf({
      titulo: def.titulo,
      filtros: filtrosTexto(),
      colunas: colunas.map((c) => c.titulo),
      larguras: Object.fromEntries(colunas.map((c, i) => [i, c.largura]).filter(([i]) => i !== 0)),
      grupos: grupos.map((g) => ({ titulo: g.titulo, linhas: g.lista.map((e) => colunas.map((c) => c.valor(e))) })),
      rotuloGrupo: def.rotulo,
      paisagem: true,
      nomeArquivo: `${def.titulo.toLowerCase().replace(/\s+/g, "-")}-${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`,
    });
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const linhas = grupos.flatMap((g) =>
      g.lista.map((e: any) => ({
        ...(agrupar !== "all" ? { [def.rotulo]: g.titulo } : {}),
        Nome: e.nome_completo,
        CPF: e.cpf || "",
        Cargo: e.cargo || "",
        Setor: e.setor || "",
        Empresa: e.empresas?.nome || "",
        "Data de admissão": formatDateOnlyPtBR(e.data_admissao),
        Contrato: CONTRATO[e.tipo_contrato] || e.tipo_contrato || "",
        Situação: STATUS[e.status] || e.status || "",
        Sexo: e.sexo || "",
      })),
    );
    const ws = XLSX.utils.json_to_sheet(linhas);
    ws["!cols"] = Object.keys(linhas[0] || {}).map((k) => ({ wch: k === "Nome" ? 40 : k === "Empresa" ? 36 : 18 }));
    XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");
    if (agrupar !== "all") {
      const resumo = grupos.map((g) => ({ [def.rotulo]: g.titulo, Quantidade: g.lista.length }));
      resumo.push({ [def.rotulo]: "Total", Quantidade: filtrados.length } as any);
      const wr = XLSX.utils.json_to_sheet(resumo);
      wr["!cols"] = [{ wch: 36 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wr, "Resumo");
    }
    XLSX.writeFile(wb, `${def.titulo.toLowerCase().replace(/\s+/g, "-")}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Relatório de colaboradores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="rel-agrupar">Agrupar por</Label>
              <Select value={agrupar} onValueChange={setAgrupar}>
                <SelectTrigger id="rel-agrupar"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sector">Setor</SelectItem>
                  <SelectItem value="company">Empresa</SelectItem>
                  <SelectItem value="cargo">Cargo</SelectItem>
                  <SelectItem value="status">Situação</SelectItem>
                  <SelectItem value="contract">Tipo de contrato</SelectItem>
                  <SelectItem value="gender">Sexo</SelectItem>
                  <SelectItem value="all">Não agrupar (lista única)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rel-status">Situação</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="rel-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativos">Ativos (sem demitidos)</SelectItem>
                  <SelectItem value="ativo">Só trabalhando</SelectItem>
                  <SelectItem value="ferias">De férias</SelectItem>
                  <SelectItem value="afastado">Afastados</SelectItem>
                  <SelectItem value="em_admissao">Em admissão</SelectItem>
                  <SelectItem value="demitido">Demitidos</SelectItem>
                  <SelectItem value="all">Todos, inclusive demitidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rel-busca">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="rel-busca" placeholder="Nome ou cargo" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rel-empresa">Empresa</Label>
              <Select value={empresa} onValueChange={setEmpresa}>
                <SelectTrigger id="rel-empresa"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {companies?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rel-setor">Setor</Label>
              <Select value={setor} onValueChange={setSetor}>
                <SelectTrigger id="rel-setor"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {sectors?.map((s) => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rel-contrato">Contrato</Label>
                <Select value={contrato} onValueChange={setContrato}>
                  <SelectTrigger id="rel-contrato"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="fixo">Fixo (CLT)</SelectItem>
                    <SelectItem value="intermitente">Intermitente</SelectItem>
                    <SelectItem value="prestador_servico">Prestador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rel-sexo">Sexo</Label>
                <Select value={sexo} onValueChange={setSexo}>
                  <SelectTrigger id="rel-sexo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{filtrados.length}</strong> colaboradores
              {agrupar !== "all" && <> em <strong className="text-foreground">{grupos.length}</strong> {def.rotulo.toLowerCase()}{grupos.length === 1 ? "" : "s"}</>}
            </p>
            <ExportButtons onExportPDF={exportToPDF} onExportExcel={exportToExcel} disabled={filtrados.length === 0} />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : filtrados.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum colaborador com esses filtros.</CardContent></Card>
      ) : (
        <>
          {agrupar !== "all" && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Resumo por {def.rotulo.toLowerCase()}</CardTitle></CardHeader>
              <CardContent>
                <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {grupos.map((g) => (
                    <li key={g.titulo}>
                      <a href={`#grupo-${encodeURIComponent(g.titulo)}`} className="group block rounded-md p-1 hover:bg-muted/60">
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
            <Card key={g.titulo} id={`grupo-${encodeURIComponent(g.titulo)}`} className="scroll-mt-24 overflow-hidden">
              {agrupar !== "all" && (
                <div className="flex items-baseline justify-between gap-3 border-b bg-muted/40 px-4 py-3">
                  <h3 className="font-semibold">{g.titulo}</h3>
                  <span className="text-sm text-muted-foreground">{g.lista.length} {g.lista.length === 1 ? "pessoa" : "pessoas"}</span>
                </div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-right">#</TableHead>
                      {colunas.map((c) => <TableHead key={c.chave}>{c.titulo}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.lista.map((e: any, i: number) => (
                      <TableRow key={e.id}>
                        <TableCell className="py-2 text-right text-muted-foreground tabular-nums">{i + 1}</TableCell>
                        {colunas.map((c) => (
                          <TableCell key={c.chave} className={`py-2 ${c.chave === "nome" ? "font-medium" : ""}`}>{c.valor(e)}</TableCell>
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
};

export default EmployeeReports;

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Scale, Search, Loader2, CheckCircle, AlertTriangle, History, ExternalLink,
  Plus, Trash2, HelpCircle, Info, RefreshCw, Check, X, PencilLine,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Employee {
  id: string;
  nome_completo: string;
  cpf: string | null;
  cargo: string;
  setor: string | null;
  status: string | null;
}

interface ConsultaResult {
  id: string;
  employee_id: string;
  data_consulta: string;
  processos_encontrados: number;
  resumo: string | null;
  resultado: any;
}

interface ProcessoManual {
  numero_processo: string;
  tribunal: string;
  link: string;
  observacao: string;
}

// Consultas antigas feitas pela IA sem acesso à internet não são confiáveis
const ORIGENS_CONFIAVEIS = ["manual", "gemini-google-search", "tavily"];
const consultaConfiavel = (c?: ConsultaResult) => !!c && ORIGENS_CONFIAVEIS.includes(c.resultado?._provider);

interface Candidato {
  titulo: string;
  url: string;
  trecho: string;
  numeros: string[];
  tribunais: string[];
  revisao: null | "confirmado" | "descartado";
}

const candidatosDe = (c?: ConsultaResult): Candidato[] =>
  c?.resultado?._provider === "tavily" ? (c.resultado.candidatos || []) : [];
const pendentesDe = (c?: ConsultaResult) => candidatosDe(c).filter((x) => !x.revisao).length;

const processoVazio = (): ProcessoManual => ({ numero_processo: "", tribunal: "", link: "", observacao: "" });

function linksDePesquisa(nome: string) {
  const nomeAspas = encodeURIComponent(`"${nome.trim()}"`);
  return [
    {
      titulo: "JusBrasil",
      descricao: "Processos e diários oficiais pelo nome",
      url: `https://www.jusbrasil.com.br/busca?q=${nomeAspas}`,
    },
    {
      titulo: "Escavador",
      descricao: "Processos e citações em diários",
      url: `https://www.escavador.com/busca?q=${nomeAspas}`,
    },
    {
      titulo: "Google",
      descricao: "Nome exato + processo",
      url: `https://www.google.com/search?q=${nomeAspas}+processo`,
    },
  ];
}

export default function ConsultaJudicial() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [consultas, setConsultas] = useState<Record<string, ConsultaResult>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailDialog, setDetailDialog] = useState<ConsultaResult | null>(null);
  const [buscandoId, setBuscandoId] = useState<string | null>(null);
  const [lote, setLote] = useState<{ atual: number; total: number } | null>(null);

  // Pesquisa manual
  const [pesquisaEmp, setPesquisaEmp] = useState<Employee | null>(null);
  const [encontrou, setEncontrou] = useState<boolean | null>(null);
  const [processos, setProcessos] = useState<ProcessoManual[]>([processoVazio()]);
  const [observacaoGeral, setObservacaoGeral] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [empRes, consultaRes] = await Promise.all([
      supabase
        .from("employees")
        .select("id, nome_completo, cpf, cargo, setor, status")
        .in("status", ["ativo", "ferias"])
        .not("cpf", "is", null)
        .order("nome_completo"),
      supabase
        .from("consultas_judiciais")
        .select("*")
        .order("data_consulta", { ascending: false }),
    ]);

    if (empRes.data) setEmployees(empRes.data);

    if (consultaRes.data) {
      const map: Record<string, ConsultaResult> = {};
      for (const c of consultaRes.data) {
        if (!map[c.employee_id]) {
          map[c.employee_id] = c as ConsultaResult;
        }
      }
      setConsultas(map);
    }
    setLoading(false);
  };

  const buscarAutomatico = async (emp: Employee, silencioso = false): Promise<boolean> => {
    setBuscandoId(emp.id);
    try {
      const { data, error } = await supabase.functions.invoke("consulta-judicial", {
        body: { employee_id: emp.id, nome: emp.nome_completo },
      });
      if (error) {
        let msg = error.message;
        try { msg = (await (error as any).context?.json())?.error || msg; } catch { /* mantém a mensagem */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      if ((data as any)?.consulta) {
        setConsultas((prev) => ({ ...prev, [emp.id]: (data as any).consulta }));
      }
      if (!silencioso) {
        const n = (data as any)?.candidatos || 0;
        if (n > 0) toast.warning(`${n} resultado(s) para conferir: ${emp.nome_completo}`);
        else toast.success(`Nada encontrado para ${emp.nome_completo}`);
      }
      return true;
    } catch (e: any) {
      toast.error("Erro na busca: " + (e.message || "Erro desconhecido"));
      return false;
    } finally {
      setBuscandoId(null);
    }
  };

  const buscarTodos = async () => {
    const alvo = filteredEmployees.filter((e) => !consultaConfiavel(consultas[e.id]));
    if (alvo.length === 0) {
      toast.info("Todos os colaboradores da lista já foram pesquisados.");
      return;
    }
    if (!window.confirm(`Pesquisar ${alvo.length} colaborador(es) ainda não pesquisados? Cada um usa 1 ou 2 das 1.000 buscas grátis do mês.`)) return;
    setLote({ atual: 0, total: alvo.length });
    for (let i = 0; i < alvo.length; i++) {
      setLote({ atual: i + 1, total: alvo.length });
      const ok = await buscarAutomatico(alvo[i], true);
      if (!ok) break; // erro de chave ou limite: para o lote
    }
    setLote(null);
    await loadData();
    toast.success("Busca em lote finalizada. Confira os marcados em amarelo.");
  };

  const revisarCandidato = async (consulta: ConsultaResult, indice: number, revisao: "confirmado" | "descartado" | null) => {
    const candidatos = candidatosDe(consulta).map((c, i) => (i === indice ? { ...c, revisao } : c));
    const confirmados = candidatos.filter((c) => c.revisao === "confirmado").length;
    const pendentes = candidatos.filter((c) => !c.revisao).length;
    const resumo = pendentes > 0
      ? `${candidatos.length} resultado(s) citando o nome; ${pendentes} para conferir.`
      : confirmados > 0
        ? `${confirmados} resultado(s) confirmado(s) como sendo do colaborador.`
        : "Resultados conferidos: nenhum é do colaborador.";
    const atualizado = {
      ...consulta,
      processos_encontrados: confirmados,
      resumo,
      resultado: { ...consulta.resultado, candidatos },
    };
    const { error } = await supabase.from("consultas_judiciais")
      .update({ processos_encontrados: confirmados, resumo, resultado: atualizado.resultado })
      .eq("id", consulta.id);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    setConsultas((prev) => ({ ...prev, [consulta.employee_id]: atualizado }));
    setDetailDialog(atualizado);
  };

  const abrirPesquisa = (emp: Employee) => {
    setPesquisaEmp(emp);
    setEncontrou(null);
    setProcessos([processoVazio()]);
    setObservacaoGeral("");
  };

  const atualizarProcesso = (i: number, campo: keyof ProcessoManual, valor: string) => {
    setProcessos((prev) => prev.map((p, idx) => (idx === i ? { ...p, [campo]: valor } : p)));
  };

  const salvarResultado = async () => {
    if (!pesquisaEmp || encontrou === null) return;

    const preenchidos = processos.filter((p) => p.numero_processo.trim() || p.link.trim() || p.observacao.trim());
    if (encontrou && preenchidos.length === 0) {
      toast.error("Informe pelo menos o número ou o link de um processo");
      return;
    }

    setSalvando(true);
    const { data: userData } = await supabase.auth.getUser();
    const lista = encontrou ? preenchidos : [];
    const resumo = encontrou
      ? `${lista.length} processo(s) registrado(s) em pesquisa manual.${observacaoGeral ? " " + observacaoGeral : ""}`
      : `Nenhum processo encontrado em pesquisa manual (JusBrasil, Escavador e Google).${observacaoGeral ? " " + observacaoGeral : ""}`;

    const { error } = await supabase.from("consultas_judiciais").insert({
      employee_id: pesquisaEmp.id,
      processos_encontrados: lista.length,
      resumo,
      consultado_por: userData.user?.id,
      resultado: {
        _provider: "manual",
        processos: lista.map((p) => ({
          numero_processo: p.numero_processo.trim() || "não informado",
          tribunal: p.tribunal.trim(),
          resumo: p.observacao.trim(),
          fonte: p.link.trim(),
        })),
        fontes: lista.map((p) => p.link.trim()).filter(Boolean),
        observacao: observacaoGeral,
      },
    });
    setSalvando(false);

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(`Resultado registrado para ${pesquisaEmp.nome_completo}`);
    setPesquisaEmp(null);
    await loadData();
  };

  const filteredEmployees = employees.filter(
    (e) =>
      e.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.cpf && e.cpf.includes(searchTerm))
  );

  const consultasConfiaveis = Object.values(consultas).filter(consultaConfiavel);
  const totalConsultados = consultasConfiaveis.length;
  const totalComProcesso = consultasConfiaveis.filter((c) => c.processos_encontrados > 0).length;
  const totalParaConferir = consultasConfiaveis.filter((c) => pendentesDe(c) > 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6" />
            Consulta Judicial
          </h1>
          <p className="text-muted-foreground text-sm">
            Busca automática no JusBrasil e no Escavador pelo nome exato. Você só confere os resultados.
          </p>
        </div>
        <Button onClick={buscarTodos} disabled={!!lote || !!buscandoId} variant="outline">
          {lote ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{lote.atual}/{lote.total}</>
          ) : (
            <><RefreshCw className="h-4 w-4 mr-2" />Buscar todos</>
          )}
        </Button>
      </div>

      <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
        <CardContent className="pt-4 text-sm flex gap-3">
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              A pesquisa é feita pelo <strong>nome</strong>, então pode aparecer outra pessoa com o mesmo nome.
              Abra o processo e confira os dados antes de registrar.
            </p>
            <p className="text-muted-foreground">
              Usar ações trabalhistas contra outros empregadores para decidir contratação, promoção ou demissão
              pode ser considerado discriminatório pela Justiça do Trabalho.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{employees.length}</div>
            <p className="text-sm text-muted-foreground">Colaboradores com CPF</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalConsultados}</div>
            <p className="text-sm text-muted-foreground">Já pesquisados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">{totalComProcesso}</div>
            <p className="text-sm text-muted-foreground">Confirmados com processo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-600">{totalParaConferir}</div>
            <p className="text-sm text-muted-foreground">Para conferir</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou CPF..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Colaboradores</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Última Pesquisa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((emp) => {
                const consulta = consultas[emp.id];
                const confiavel = consultaConfiavel(consulta);
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.nome_completo}</TableCell>
                    <TableCell className="font-mono text-sm">{emp.cpf}</TableCell>
                    <TableCell>{emp.cargo}</TableCell>
                    <TableCell>
                      {consulta ? (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(consulta.data_consulta), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Nunca</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {!consulta ? (
                        <Badge variant="outline">Não pesquisado</Badge>
                      ) : !confiavel ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-amber-400 text-amber-700 dark:text-amber-300"
                          title="Consulta antiga feita pela IA sem acesso à internet. Pesquise de novo."
                        >
                          <HelpCircle className="h-3 w-3" />
                          Não verificado
                        </Badge>
                      ) : pendentesDe(consulta) > 0 ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 cursor-pointer"
                          onClick={() => setDetailDialog(consulta)}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {pendentesDe(consulta)} para conferir
                        </Badge>
                      ) : consulta.processos_encontrados > 0 ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {consulta.processos_encontrados} processo(s)
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle className="h-3 w-3" />
                          Nada encontrado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {consulta && (
                        <Button size="sm" variant="ghost" onClick={() => setDetailDialog(consulta)} title="Ver última pesquisa">
                          <History className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => abrirPesquisa(emp)} title="Pesquisar e registrar manualmente">
                        <PencilLine className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => buscarAutomatico(emp)}
                        disabled={buscandoId === emp.id || !!lote}
                      >
                        {buscandoId === emp.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <><Search className="h-4 w-4 mr-1" />Buscar</>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredEmployees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum colaborador encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pesquisa manual */}
      <Dialog open={!!pesquisaEmp} onOpenChange={(aberto) => !aberto && setPesquisaEmp(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pesquisar processos</DialogTitle>
            <DialogDescription>
              {pesquisaEmp?.nome_completo} · CPF {pesquisaEmp?.cpf}
            </DialogDescription>
          </DialogHeader>

          {pesquisaEmp && (
            <ScrollArea className="max-h-[65vh] pr-3">
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium mb-2">1. Abra a pesquisa (cada uma abre em uma nova aba)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {linksDePesquisa(pesquisaEmp.nome_completo).map((l) => (
                      <a key={l.titulo} href={l.url} target="_blank" rel="noopener noreferrer">
                        <Card className="h-full hover:border-primary transition-colors">
                          <CardContent className="p-3">
                            <p className="font-medium text-sm flex items-center gap-1">
                              {l.titulo} <ExternalLink className="h-3 w-3" />
                            </p>
                            <p className="text-xs text-muted-foreground">{l.descricao}</p>
                          </CardContent>
                        </Card>
                      </a>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Para confirmar que é a mesma pessoa, compare cidade, nome dos pais ou outros dados do processo.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">2. O que você encontrou?</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={encontrou === false ? "default" : "outline"}
                      onClick={() => setEncontrou(false)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" /> Nada encontrado
                    </Button>
                    <Button
                      type="button"
                      variant={encontrou === true ? "destructive" : "outline"}
                      onClick={() => setEncontrou(true)}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" /> Encontrei processo(s)
                    </Button>
                  </div>
                </div>

                {encontrou && (
                  <div className="space-y-3">
                    {processos.map((p, i) => (
                      <Card key={i}>
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Processo {i + 1}</p>
                            {processos.length > 1 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setProcessos((prev) => prev.filter((_, idx) => idx !== i))}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Número do processo</Label>
                              <Input
                                placeholder="0000000-00.0000.0.00.0000"
                                value={p.numero_processo}
                                onChange={(e) => atualizarProcesso(i, "numero_processo", e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Tribunal</Label>
                              <Input
                                placeholder="Ex.: TRT1, TJRJ"
                                value={p.tribunal}
                                onChange={(e) => atualizarProcesso(i, "tribunal", e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Link</Label>
                            <Input
                              placeholder="Cole o endereço da página do processo"
                              value={p.link}
                              onChange={(e) => atualizarProcesso(i, "link", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Observação</Label>
                            <Input
                              placeholder="Ex.: reclamação trabalhista, arquivado"
                              value={p.observacao}
                              onChange={(e) => atualizarProcesso(i, "observacao", e.target.value)}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setProcessos((prev) => [...prev, processoVazio()])}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Adicionar outro processo
                    </Button>
                  </div>
                )}

                {encontrou !== null && (
                  <div className="space-y-1">
                    <Label className="text-xs">Observação geral (opcional)</Label>
                    <Textarea
                      rows={2}
                      value={observacaoGeral}
                      onChange={(e) => setObservacaoGeral(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPesquisaEmp(null)}>Cancelar</Button>
            <Button onClick={salvarResultado} disabled={encontrou === null || salvando}>
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar resultado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Última pesquisa</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {detailDialog && (
              <div className="space-y-4">
                {!consultaConfiavel(detailDialog) && (
                  <div className="text-sm rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3">
                    Esta consulta foi feita pela IA sem acesso à internet e <strong>não é confiável</strong>.
                    Faça uma nova pesquisa.
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {format(new Date(detailDialog.data_consulta), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Confirmados</p>
                  <p className="font-medium">{detailDialog.processos_encontrados}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Resumo</p>
                  <p className="text-sm">{detailDialog.resumo || "Sem resumo disponível"}</p>
                </div>
                {candidatosDe(detailDialog).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Resultados que citam o nome. Abra o link e confira se é a mesma pessoa.
                    </p>
                    {candidatosDe(detailDialog).map((c, i) => (
                      <Card
                        key={i}
                        className={
                          c.revisao === "confirmado" ? "border-destructive" :
                          c.revisao === "descartado" ? "opacity-60" : "border-amber-300"
                        }
                      >
                        <CardContent className="pt-4 text-sm space-y-2">
                          <a href={c.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline flex items-start gap-1">
                            <span className="break-words">{c.titulo}</span> <ExternalLink className="h-3 w-3 shrink-0 mt-1" />
                          </a>
                          {c.trecho && <p className="text-xs text-muted-foreground line-clamp-3">{c.trecho}</p>}
                          {c.numeros.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {c.numeros.map((n, j) => (
                                <Badge key={n} variant="outline" className="font-mono text-xs">
                                  {n}{c.tribunais[j] ? ` · ${c.tribunais[j]}` : ""}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {c.revisao ? (
                              <>
                                <Badge variant={c.revisao === "confirmado" ? "destructive" : "secondary"}>
                                  {c.revisao === "confirmado" ? "É do colaborador" : "Não é o colaborador"}
                                </Badge>
                                <Button size="sm" variant="ghost" onClick={() => revisarCandidato(detailDialog, i, null)}>
                                  Desfazer
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" variant="destructive" onClick={() => revisarCandidato(detailDialog, i, "confirmado")}>
                                  <Check className="h-4 w-4 mr-1" /> É ele
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => revisarCandidato(detailDialog, i, "descartado")}>
                                  <X className="h-4 w-4 mr-1" /> Não é
                                </Button>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                {detailDialog.resultado?.processos?.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Processos</p>
                    <div className="space-y-2">
                      {detailDialog.resultado.processos.map((p: any, i: number) => (
                        <Card key={i}>
                          <CardContent className="pt-4 text-sm space-y-1">
                            {p.numero_processo && <p><strong>Nº:</strong> {p.numero_processo}</p>}
                            {p.tribunal && <p><strong>Tribunal:</strong> {p.tribunal}</p>}
                            {p.tipo && <p><strong>Tipo:</strong> {p.tipo}</p>}
                            {p.status && <p><strong>Status:</strong> {p.status}</p>}
                            {p.polo && <p><strong>Polo:</strong> {p.polo}</p>}
                            {p.resumo && <p><strong>Observação:</strong> {p.resumo}</p>}
                            {p.fonte && /^https?:\/\//.test(p.fonte) && (
                              <a href={p.fonte} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
                                {p.fonte}
                              </a>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

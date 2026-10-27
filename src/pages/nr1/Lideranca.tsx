import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, Plus, Link2, AlertTriangle, ShieldCheck, Copy, BarChart3, Power, Search } from "lucide-react";
import { toast } from "sonner";
import { todayISO } from "@/lib/date";

export const PERGUNTAS_LIDERANCA = [
  { id: "comunicacao", texto: "O líder se comunica de forma clara e respeitosa." },
  { id: "pressao", texto: "O líder gerencia a pressão sem prejudicar a equipe." },
  { id: "organizacao", texto: "O líder é organizado e planeja bem as atividades." },
  { id: "favoritismo", texto: "O líder trata todos os membros da equipe com equidade." },
  { id: "apoio_emocional", texto: "O líder demonstra apoio emocional quando necessário." },
];

// Para não dar para deduzir quem respondeu, notas e comentários de um líder só aparecem a partir deste número de respostas
export const MINIMO_RESPOSTAS = 3;

const media = (rs: any[]) => {
  let soma = 0, qtd = 0;
  rs.forEach((r) => (r.respostas || []).forEach((x: any) => { soma += Number(x.valor) || 0; qtd++; }));
  return qtd ? soma / qtd : null;
};
const mediaPergunta = (rs: any[], id: string) => {
  const v = rs.flatMap((r) => (r.respostas || []).filter((x: any) => x.pergunta_id === id).map((x: any) => Number(x.valor) || 0));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const corNota = (n: number | null) => (n === null ? "" : n < 5 ? "text-red-600 dark:text-red-400" : n < 7 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400");

export default function NR1Lideranca() {
  const [pesquisas, setPesquisas] = useState<any[]>([]);
  const [respostas, setRespostas] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [lideres, setLideres] = useState<string[]>([]);
  const [buscaLider, setBuscaLider] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [linkDe, setLinkDe] = useState<any | null>(null);
  const [qr, setQr] = useState("");
  const [resultadoDe, setResultadoDe] = useState<any | null>(null);

  const load = async () => {
    const [p, r, e] = await Promise.all([
      (supabase.from("nr1_lideranca_pesquisas") as any).select("*").order("created_at", { ascending: false }),
      (supabase.from("nr1_lideranca_respostas") as any).select("*"),
      supabase.from("employees").select("id, nome_completo, cargo, setor").neq("status", "demitido").order("nome_completo"),
    ]);
    setPesquisas(p.data || []); setRespostas(r.data || []); setEmployees(e.data || []);
  };
  useEffect(() => { load(); }, []);

  const nome = (id: string) => employees.find((e) => e.id === id)?.nome_completo || "—";
  const lideresDe = (p: any): string[] => (p.lideres?.length ? p.lideres : p.lider_employee_id ? [p.lider_employee_id] : []);
  const respostasDe = (p: any, lider?: string) => respostas.filter((r) => r.pesquisa_id === p.id && (!lider || (r.lider_employee_id || p.lider_employee_id) === lider));
  const link = (p: any) => `${window.location.origin}/lideranca/${p.codigo}`;
  const aberta = (p: any) => p.ativa && (!p.data_fim || p.data_fim >= todayISO());

  const criar = async () => {
    if (!titulo.trim()) return toast.error("Dê um título para a pesquisa");
    if (!lideres.length) return toast.error("Escolha pelo menos um líder");
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await (supabase.from("nr1_lideranca_pesquisas") as any)
      .insert({ titulo: titulo.trim(), lideres, lider_employee_id: lideres.length === 1 ? lideres[0] : null, data_fim: dataFim || null, created_by: user?.id })
      .select("*").single();
    if (error) return toast.error(error.message.includes("lideres") ? "Rode no Supabase o arquivo 14-lideranca-link-unico.sql" : error.message);
    toast.success("Pesquisa criada. Agora é só compartilhar o link.");
    setOpen(false); setTitulo(""); setLideres([]); setDataFim("");
    await load();
    abrirLink(data);
  };

  const abrirLink = async (p: any) => {
    setLinkDe(p);
    setQr(await QRCode.toDataURL(link(p), { margin: 1, width: 320 }));
  };

  const alternar = async (p: any) => {
    const { error } = await (supabase.from("nr1_lideranca_pesquisas") as any).update({ ativa: !p.ativa }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(p.ativa ? "Pesquisa encerrada: o link deixa de aceitar respostas" : "Pesquisa reaberta");
    load();
  };

  const copiar = (texto: string) => { navigator.clipboard.writeText(texto); toast.success("Link copiado"); };
  const mensagemWhats = (p: any) =>
    `Olá! Queremos ouvir você sobre a liderança do hotel.\n\nA pesquisa *${p.titulo}* é 100% anônima: ninguém fica sabendo quem respondeu.\nLeva uns 2 minutos:\n${link(p)}`;

  const lideresFiltrados = useMemo(() => {
    const t = buscaLider.trim().toLowerCase();
    return employees.filter((e) => !t || `${e.nome_completo} ${e.cargo} ${e.setor}`.toLowerCase().includes(t));
  }, [employees, buscaLider]);

  // Ranking geral por líder (todas as pesquisas)
  const ranking = useMemo(() => {
    const mapa = new Map<string, any[]>();
    respostas.forEach((r) => {
      const p = pesquisas.find((x) => x.id === r.pesquisa_id);
      const lider = r.lider_employee_id || p?.lider_employee_id;
      if (!lider) return;
      if (!mapa.has(lider)) mapa.set(lider, []);
      mapa.get(lider)!.push(r);
    });
    return Array.from(mapa.entries()).map(([id, rs]) => ({ id, nome: nome(id), qtd: rs.length, media: media(rs) }))
      .sort((a, b) => (a.qtd >= MINIMO_RESPOSTAS ? 0 : 1) - (b.qtd >= MINIMO_RESPOSTAS ? 0 : 1) || (b.media || 0) - (a.media || 0));
  }, [respostas, pesquisas, employees]);

  return (
    <div className="container mx-auto p-0 sm:p-2 lg:p-4 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><Star className="h-7 w-7 text-primary" /><h1 className="text-3xl font-bold">Avaliação de Liderança</h1></div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Nova pesquisa</Button>
      </div>

      <Card className="flex gap-3 p-4 bg-primary/5 border-primary/20">
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm">
          <strong>Um link só, 100% anônimo.</strong> Mande o mesmo link para toda a equipe: cada pessoa escolhe o próprio líder e responde.
          Nada que identifique quem respondeu é guardado, e as notas de um líder só aparecem com pelo menos {MINIMO_RESPOSTAS} respostas.
        </p>
      </Card>

      <Tabs defaultValue="pesquisas">
        <TabsList><TabsTrigger value="pesquisas">Pesquisas</TabsTrigger><TabsTrigger value="ranking">Ranking de líderes</TabsTrigger></TabsList>

        <TabsContent value="pesquisas">
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Pesquisa</TableHead><TableHead>Líderes</TableHead><TableHead className="text-center">Respostas</TableHead><TableHead>Nota média</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {pesquisas.map((p) => {
                  const ls = lideresDe(p);
                  const rs = respostasDe(p);
                  const m = rs.length >= MINIMO_RESPOSTAS ? media(rs) : null;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.titulo}</div>
                        <div className="text-xs text-muted-foreground">{p.data_fim ? `até ${p.data_fim.split("-").reverse().join("/")}` : "sem data para encerrar"}</div>
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <div className="truncate text-sm" title={ls.map(nome).join(", ")}>{ls.length === 1 ? nome(ls[0]) : `${ls.length} líderes`}</div>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{rs.length}</TableCell>
                      <TableCell>
                        {m !== null ? <span className={`font-bold ${corNota(m)}`}>{m.toFixed(1)}</span> : <span className="text-xs text-muted-foreground">{rs.length ? `aguardando ${MINIMO_RESPOSTAS} respostas` : "—"}</span>}
                      </TableCell>
                      <TableCell>{aberta(p) ? <Badge>Recebendo respostas</Badge> : <Badge variant="secondary">Encerrada</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {p.codigo && <Button size="sm" onClick={() => abrirLink(p)}><Link2 className="h-4 w-4 mr-1" />Link</Button>}
                          <Button size="sm" variant="outline" onClick={() => setResultadoDe(p)}><BarChart3 className="h-4 w-4 mr-1" />Resultados</Button>
                          <Button size="sm" variant="ghost" onClick={() => alternar(p)} aria-label={p.ativa ? "Encerrar pesquisa" : "Reabrir pesquisa"} title={p.ativa ? "Encerrar" : "Reabrir"}><Power className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!pesquisas.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Nenhuma pesquisa ainda. Crie a primeira e mande o link para a equipe.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="ranking">
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Líder</TableHead><TableHead className="text-center">Respostas</TableHead><TableHead>Nota média</TableHead></TableRow></TableHeader>
              <TableBody>
                {ranking.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-center tabular-nums">{r.qtd}</TableCell>
                    <TableCell>
                      {r.qtd < MINIMO_RESPOSTAS ? <span className="text-xs text-muted-foreground">aguardando {MINIMO_RESPOSTAS} respostas</span> : (
                        <span className="flex items-center gap-2"><span className={`font-bold ${corNota(r.media)}`}>{r.media?.toFixed(1)}</span>{r.media !== null && r.media < 5 && <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Atenção</Badge>}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!ranking.length && <TableRow><TableCell colSpan={3} className="py-10 text-center text-muted-foreground">Sem respostas ainda</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Nova pesquisa */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova pesquisa de liderança</DialogTitle>
            <DialogDescription>Escolha quem será avaliado. Você recebe um link único para mandar a todos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="lid-titulo">Título</Label><Input id="lid-titulo" placeholder="Ex.: Avaliação de liderança — 2º semestre" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="lid-busca">Líderes avaliados</Label>
                <span className="text-xs text-muted-foreground">{lideres.length} selecionado(s)</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="lid-busca" className="pl-9" placeholder="Buscar nome, cargo ou setor" value={buscaLider} onChange={(e) => setBuscaLider(e.target.value)} />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border">
                {lideresFiltrados.map((e) => {
                  const marcado = lideres.includes(e.id);
                  return (
                    <label key={e.id} className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-0 hover:bg-muted/50">
                      <Checkbox checked={marcado} onCheckedChange={(v) => setLideres(v ? [...lideres, e.id] : lideres.filter((x) => x !== e.id))} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{e.nome_completo}</span>
                        <span className="block truncate text-xs text-muted-foreground">{[e.cargo, e.setor].filter((x: string) => x && x.trim()).join(" · ")}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="lid-fim">Encerrar em (opcional)</Label><Input id="lid-fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></div>
            <Button onClick={criar} className="w-full">Criar e gerar link</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link único */}
      <Dialog open={!!linkDe} onOpenChange={() => setLinkDe(null)}>
        <DialogContent className="max-w-md overflow-hidden">
          <DialogHeader className="min-w-0">
            <DialogTitle>Link da pesquisa</DialogTitle>
            <DialogDescription>{linkDe?.titulo} · mande o mesmo link para toda a equipe</DialogDescription>
          </DialogHeader>
          {linkDe && (
            <div className="min-w-0 space-y-4">
              <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted p-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs" title={link(linkDe)}>{link(linkDe)}</span>
                <Button size="sm" variant="ghost" className="shrink-0" onClick={() => copiar(link(linkDe))}><Copy className="h-4 w-4 mr-1" />Copiar</Button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button className="w-full" variant="outline" onClick={() => copiar(mensagemWhats(linkDe))}>Copiar mensagem pronta</Button>
                <Button className="w-full" variant="outline" asChild>
                  <a href={`https://wa.me/?text=${encodeURIComponent(mensagemWhats(linkDe))}`} target="_blank" rel="noreferrer">Enviar no WhatsApp</a>
                </Button>
              </div>
              {qr && (
                <div className="flex flex-col items-center gap-2 rounded-lg border p-4">
                  <img src={qr} alt="QR code do link da pesquisa" className="h-48 w-48" />
                  <a href={qr} download={`qr-${linkDe.titulo}.png`} className="text-sm text-primary underline">Baixar QR code para imprimir no mural</a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resultados */}
      <Dialog open={!!resultadoDe} onOpenChange={() => setResultadoDe(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resultados — {resultadoDe?.titulo}</DialogTitle>
            <DialogDescription>{resultadoDe ? respostasDe(resultadoDe).length : 0} respostas · notas de 1 a 10</DialogDescription>
          </DialogHeader>
          {resultadoDe && (
            <div className="space-y-4">
              {lideresDe(resultadoDe).map((lid) => {
                const rs = respostasDe(resultadoDe, lid);
                const ok = rs.length >= MINIMO_RESPOSTAS;
                const m = ok ? media(rs) : null;
                const comentarios = ok ? rs.map((r) => r.comentario).filter(Boolean) : [];
                return (
                  <Card key={lid} className="p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-semibold">{nome(lid)}</h3>
                      <span className="text-sm text-muted-foreground">{rs.length} {rs.length === 1 ? "resposta" : "respostas"}{m !== null && <> · média <strong className={corNota(m)}>{m.toFixed(1)}</strong></>}</span>
                    </div>
                    {!ok ? (
                      <p className="mt-2 text-sm text-muted-foreground">As notas aparecem a partir de {MINIMO_RESPOSTAS} respostas, para ninguém ser identificado.</p>
                    ) : (
                      <>
                        <ul className="mt-3 space-y-2">
                          {PERGUNTAS_LIDERANCA.map((q) => {
                            const v = mediaPergunta(rs, q.id);
                            return (
                              <li key={q.id}>
                                <div className="flex justify-between gap-3 text-sm"><span>{q.texto}</span><span className={`font-semibold tabular-nums ${corNota(v)}`}>{v?.toFixed(1) ?? "—"}</span></div>
                                <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${((v || 0) / 10) * 100}%` }} /></div>
                              </li>
                            );
                          })}
                        </ul>
                        {comentarios.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <p className="text-sm font-medium">Comentários</p>
                            {comentarios.map((c, i) => <p key={i} className="rounded-md bg-muted/60 p-2 text-sm">“{c}”</p>)}
                          </div>
                        )}
                      </>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

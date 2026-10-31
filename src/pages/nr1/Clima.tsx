import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERGUNTAS_PADRAO, type PerguntaClima } from "@/lib/nr1/perguntasPadrao";
import { Smile, Plus, Link2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { dataBR } from "@/lib/date";

export default function NR1Clima() {
  const [pesquisas, setPesquisas] = useState<any[]>([]);
  const [respostas, setRespostas] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [perguntas, setPerguntas] = useState<PerguntaClima[]>([...PERGUNTAS_PADRAO]);
  const [novaPergunta, setNovaPergunta] = useState("");
  const [novaInversa, setNovaInversa] = useState(false);
  const [qtdSortear, setQtdSortear] = useState<number>(PERGUNTAS_PADRAO.length);
  const [loading, setLoading] = useState(false);
  const [tokensDialog, setTokensDialog] = useState<{ pesquisa: any; tokens: string[] } | null>(null);

  const load = async () => {
    const [p, r] = await Promise.all([
      (supabase.from("nr1_pesquisas_clima") as any).select("*").order("created_at", { ascending: false }),
      (supabase.from("nr1_clima_respostas") as any).select("*"),
    ]);
    setPesquisas(p.data || []);
    setRespostas(r.data || []);
  };
  useEffect(() => { load(); }, []);

  const adicionarPergunta = () => {
    const texto = novaPergunta.trim();
    if (!texto) return;
    const id = `q_${Date.now()}`;
    setPerguntas([...perguntas, { id, texto, inversa: novaInversa }]);
    setNovaPergunta("");
    setNovaInversa(false);
  };

  const removerPergunta = (id: string) => {
    setPerguntas(perguntas.filter((p) => p.id !== id));
  };

  const resetForm = () => {
    setTitulo(""); setDescricao("");
    setPerguntas([...PERGUNTAS_PADRAO]);
    setQtdSortear(PERGUNTAS_PADRAO.length);
    setNovaPergunta(""); setNovaInversa(false);
  };

  const criar = async () => {
    if (!titulo.trim()) return toast.error("Informe o título");
    if (perguntas.length === 0) return toast.error("Adicione ao menos uma pergunta");
    const qtd = Math.max(1, Math.min(qtdSortear || perguntas.length, perguntas.length));
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from("nr1_pesquisas_clima") as any).insert({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      perguntas,
      qtd_sortear: qtd,
      status: "ativa",
      created_by: user?.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Pesquisa criada"); setOpen(false); resetForm(); load(); }
    setLoading(false);
  };

  const gerarTokens = async (pesquisa: any, qtd: number) => {
    const rows = Array.from({ length: qtd }, () => ({ pesquisa_id: pesquisa.id }));
    const { data, error } = await (supabase.from("nr1_pesquisa_tokens") as any).insert(rows).select("token");
    if (error) { toast.error(error.message); return; }
    setTokensDialog({ pesquisa, tokens: (data || []).map((t: any) => t.token) });
  };

  const toggleStatus = async (p: any) => {
    const novo = p.status === "ativa" ? "encerrada" : "ativa";
    await (supabase.from("nr1_pesquisas_clima") as any).update({ status: novo }).eq("id", p.id);
    load();
  };

  // Resultados (escala 1-10)
  const calcNota = (pesquisaId: string) => {
    const rs = respostas.filter((r) => r.pesquisa_id === pesquisaId);
    const notas: number[] = [];
    rs.forEach((r) => (r.respostas || []).forEach((x: any) => typeof x.valor === "number" && notas.push(x.valor)));
    return notas.length ? +(notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(2) : null;
  };

  const corNota = (n: number | null) => {
    if (n === null) return undefined;
    if (n >= 8) return "rgb(34 197 94)";
    if (n >= 6) return "rgb(234 179 8)";
    return "rgb(239 68 68)";
  };

  return (
    <div className="container mx-auto p-0 sm:p-2 lg:p-4 space-y-6">
      <div>
        <h1 className="text-xl font-medium leading-tight flex items-center gap-2">
          <Smile className="h-5 w-5 text-primary" />
          Pesquisa de Clima Organizacional
        </h1>
        <p className="text-muted-foreground mt-2">Pesquisas anônimas com perguntas personalizáveis (escala 1-10)</p>
      </div>

      <Tabs defaultValue="pesquisas">
        <TabsList>
          <TabsTrigger value="pesquisas">Pesquisas</TabsTrigger>
          <TabsTrigger value="resultados">Resultados</TabsTrigger>
        </TabsList>

        <TabsContent value="pesquisas" className="mt-6 space-y-4">
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Nova pesquisa</Button>

          <Card className="shadow-elegant">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Perguntas</TableHead>
                  <TableHead>Sorteia</TableHead>
                  <TableHead>Respostas</TableHead>
                  <TableHead>Nota média</TableHead>
                  <TableHead>Criada</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pesquisas.map((p) => {
                  const qtd = respostas.filter((r) => r.pesquisa_id === p.id).length;
                  const nota = calcNota(p.id);
                  const totalPerg = (p.perguntas || []).length;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.titulo}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "ativa" ? "default" : "secondary"}>{p.status}</Badge>
                      </TableCell>
                      <TableCell>{totalPerg}</TableCell>
                      <TableCell>{p.qtd_sortear ?? totalPerg}</TableCell>
                      <TableCell>{qtd}</TableCell>
                      <TableCell style={{ color: corNota(nota) }} className="font-semibold">{nota ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{dataBR(p.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => gerarTokens(p, 50)}>
                          <Link2 className="w-3 h-3 mr-1" />Gerar 50 links
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleStatus(p)}>
                          {p.status === "ativa" ? "Encerrar" : "Ativar"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {pesquisas.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma pesquisa criada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="resultados" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pesquisas.map((p) => {
              const nota = calcNota(p.id);
              const qtd = respostas.filter((r) => r.pesquisa_id === p.id).length;
              return (
                <Card key={p.id} className="p-5 shadow-elegant">
                  <h3 className="font-semibold">{p.titulo}</h3>
                  <p className="text-xs text-muted-foreground">{qtd} respostas</p>
                  <div className="text-4xl font-bold mt-3" style={{ color: corNota(nota) }}>
                    {nota ?? "—"}
                  </div>
                  <p className="text-xs text-muted-foreground">Nota média (1-10)</p>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova pesquisa de clima</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Título *</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
            <div><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>

            <div>
              <Label className="text-base">Perguntas ({perguntas.length})</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Configure quantas perguntas quiser. Cada respondente receberá um sorteio aleatório do total.
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-2">
                {perguntas.map((q, idx) => (
                  <div key={q.id} className="flex items-start gap-2 text-sm bg-muted/40 p-2 rounded">
                    <span className="text-muted-foreground font-mono text-xs mt-0.5">{idx + 1}.</span>
                    <span className="flex-1">{q.texto}{q.inversa && <Badge variant="outline" className="ml-2 text-[10px]">inversa</Badge>}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removerPergunta(q.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {perguntas.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-4">Nenhuma pergunta. Adicione abaixo.</p>
                )}
              </div>

              <div className="mt-3 space-y-2 border rounded-md p-3 bg-muted/20">
                <Label className="text-xs">Adicionar pergunta</Label>
                <Textarea
                  rows={2}
                  placeholder="Ex.: Você sente que sua liderança apoia seu desenvolvimento?"
                  value={novaPergunta}
                  onChange={(e) => setNovaPergunta(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch checked={novaInversa} onCheckedChange={setNovaInversa} id="inv" />
                    <Label htmlFor="inv" className="text-xs cursor-pointer">Pergunta inversa (nota baixa = melhor)</Label>
                  </div>
                  <Button size="sm" type="button" onClick={adicionarPergunta}>
                    <Plus className="h-3 w-3 mr-1" />Adicionar
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <Label>Quantas perguntas sortear por respondente *</Label>
              <Input
                type="number"
                min={1}
                max={perguntas.length || 1}
                value={qtdSortear}
                onChange={(e) => setQtdSortear(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cada link receberá {Math.min(qtdSortear || 0, perguntas.length)} perguntas escolhidas aleatoriamente entre as {perguntas.length} disponíveis.
              </p>
            </div>

            <Button onClick={criar} disabled={loading} className="w-full">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Criar pesquisa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tokensDialog} onOpenChange={(o) => !o && setTokensDialog(null)}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Links anônimos gerados</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            Distribua estes links aos funcionários. Cada link só pode ser usado uma vez e não identifica o autor.
          </p>
          <div className="space-y-1 font-mono text-xs">
            {tokensDialog?.tokens.map((t) => (
              <div key={t} className="bg-muted p-2 rounded break-all">
                {window.location.origin}/clima/{t}
              </div>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => {
              const text = tokensDialog?.tokens.map((t) => `${window.location.origin}/clima/${t}`).join("\n");
              navigator.clipboard.writeText(text || "");
              toast.success("Links copiados");
            }}
          >Copiar todos</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

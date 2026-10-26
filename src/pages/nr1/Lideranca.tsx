import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, Plus, Link2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const PERGUNTAS_LIDERANCA = [
  { id: "comunicacao", texto: "O líder se comunica de forma clara e respeitosa." },
  { id: "pressao", texto: "O líder gerencia a pressão sem prejudicar a equipe." },
  { id: "organizacao", texto: "O líder é organizado e planeja bem as atividades." },
  { id: "favoritismo", texto: "O líder trata todos os membros da equipe com equidade." },
  { id: "apoio_emocional", texto: "O líder demonstra apoio emocional quando necessário." },
];

export default function NR1Lideranca() {
  const [pesquisas, setPesquisas] = useState<any[]>([]);
  const [respostas, setRespostas] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [liderId, setLiderId] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [tokensDialog, setTokensDialog] = useState<{ p: any; tokens: string[] } | null>(null);
  const [qtdTokens, setQtdTokens] = useState(5);

  const load = async () => {
    const [p, r, e] = await Promise.all([
      (supabase.from("nr1_lideranca_pesquisas") as any).select("*").order("created_at", { ascending: false }),
      (supabase.from("nr1_lideranca_respostas") as any).select("*"),
      supabase.from("employees").select("id, nome_completo").neq("status", "demitido").order("nome_completo"),
    ]);
    setPesquisas(p.data || []); setRespostas(r.data || []); setEmployees(e.data || []);
  };
  useEffect(() => { load(); }, []);

  const criar = async () => {
    if (!titulo.trim() || !liderId) return toast.error("Preencha título e líder");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from("nr1_lideranca_pesquisas") as any).insert({
      titulo, lider_employee_id: liderId, data_fim: dataFim || null, created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Pesquisa criada"); setOpen(false); setTitulo(""); setLiderId(""); setDataFim(""); load();
  };

  const gerarTokens = async (p: any) => {
    const tokens: string[] = [];
    for (let i = 0; i < qtdTokens; i++) {
      const { data, error } = await (supabase.from("nr1_lideranca_tokens") as any).insert({ pesquisa_id: p.id }).select("token").single();
      if (!error && data) tokens.push(data.token);
    }
    setTokensDialog({ p, tokens });
  };

  const calcMedia = (pId: string) => {
    const rs = respostas.filter((r) => r.pesquisa_id === pId);
    if (!rs.length) return null;
    let soma = 0, qtd = 0;
    rs.forEach((r) => {
      (r.respostas || []).forEach((x: any) => { soma += Number(x.valor) || 0; qtd++; });
    });
    return qtd ? (soma / qtd) : null;
  };

  const baseUrl = window.location.origin;

  return (
    <div className="container mx-auto p-0 sm:p-2 lg:p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><Star className="h-7 w-7 text-primary" /><h1 className="text-3xl font-bold">Avaliação de Liderança</h1></div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Nova Pesquisa</Button>
      </div>

      <Card className="p-4 bg-primary/5 border-primary/20">
        <p className="text-sm"><strong>100% anônima:</strong> respostas não armazenam qualquer vínculo com o autor. Tokens são de uso único e não rastreiam identidade.</p>
      </Card>

      <Tabs defaultValue="pesquisas">
        <TabsList><TabsTrigger value="pesquisas">Pesquisas</TabsTrigger><TabsTrigger value="ranking">Ranking de Líderes</TabsTrigger></TabsList>

        <TabsContent value="pesquisas">
          <Card className="shadow-elegant">
            <Table>
              <TableHeader><TableRow><TableHead>Pesquisa</TableHead><TableHead>Líder</TableHead><TableHead>Respostas</TableHead><TableHead>Nota Média</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {pesquisas.map((p) => {
                  const lider = employees.find((e) => e.id === p.lider_employee_id)?.nome_completo || "—";
                  const qtd = respostas.filter((r) => r.pesquisa_id === p.id).length;
                  const media = calcMedia(p.id);
                  const toxica = media !== null && media < 5;
                  return (
                    <TableRow key={p.id}>
                      <TableCell><div className="font-medium">{p.titulo}</div></TableCell>
                      <TableCell>{lider}</TableCell>
                      <TableCell>{qtd}</TableCell>
                      <TableCell>
                        {media !== null ? (
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{media.toFixed(1)}</span>
                            {toxica && <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Atenção</Badge>}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => gerarTokens(p)}><Link2 className="h-4 w-4 mr-1" />Gerar links</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!pesquisas.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma pesquisa</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="ranking">
          <Card className="shadow-elegant">
            <Table>
              <TableHeader><TableRow><TableHead>Líder</TableHead><TableHead>Pesquisas</TableHead><TableHead>Total Respostas</TableHead><TableHead>Nota Média</TableHead></TableRow></TableHeader>
              <TableBody>
                {(() => {
                  const map = new Map<string, { pesq: number; resp: number; soma: number; qtd: number }>();
                  pesquisas.forEach((p) => {
                    const k = p.lider_employee_id;
                    const cur = map.get(k) || { pesq: 0, resp: 0, soma: 0, qtd: 0 };
                    cur.pesq++;
                    respostas.filter((r) => r.pesquisa_id === p.id).forEach((r) => {
                      cur.resp++;
                      (r.respostas || []).forEach((x: any) => { cur.soma += Number(x.valor) || 0; cur.qtd++; });
                    });
                    map.set(k, cur);
                  });
                  const rows = Array.from(map.entries()).map(([id, v]) => ({
                    id, nome: employees.find((e) => e.id === id)?.nome_completo || "—",
                    pesq: v.pesq, resp: v.resp, media: v.qtd ? v.soma / v.qtd : null,
                  })).sort((a, b) => (b.media || 0) - (a.media || 0));
                  if (!rows.length) return <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem dados</TableCell></TableRow>;
                  return rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell>{r.pesq}</TableCell>
                      <TableCell>{r.resp}</TableCell>
                      <TableCell>{r.media !== null ? r.media.toFixed(1) : "—"} {r.media !== null && r.media < 5 && <Badge variant="destructive" className="ml-2">Tóxica</Badge>}</TableCell>
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Pesquisa de Liderança</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
            <div><Label>Líder avaliado</Label>
              <Select value={liderId} onValueChange={setLiderId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.nome_completo}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Data fim (opcional)</Label><Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></div>
            <Button onClick={criar} className="w-full">Criar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tokensDialog} onOpenChange={() => setTokensDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Links anônimos — {tokensDialog?.p.titulo}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="flex gap-2 mb-2">
              <Input type="number" value={qtdTokens} onChange={(e) => setQtdTokens(Number(e.target.value) || 1)} className="w-24" />
              <Button onClick={() => tokensDialog && gerarTokens(tokensDialog.p)}>Gerar mais</Button>
            </div>
            <div className="max-h-96 overflow-auto space-y-1">
              {tokensDialog?.tokens.map((t) => {
                const url = `${baseUrl}/nr1/lideranca/responder/${t}`;
                return (
                  <div key={t} className="flex gap-2 items-center text-xs bg-muted p-2 rounded">
                    <span className="flex-1 truncate font-mono">{url}</span>
                    <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(url); toast.success("Copiado"); }}>Copiar</Button>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

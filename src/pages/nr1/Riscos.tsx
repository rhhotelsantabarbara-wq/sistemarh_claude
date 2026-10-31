import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIAS = [
  "Sobrecarga de trabalho",
  "Assédio moral",
  "Assédio sexual",
  "Conflito interpessoal",
  "Falta de reconhecimento",
  "Liderança tóxica",
  "Insegurança no emprego",
  "Falta de autonomia",
  "Jornada excessiva",
  "Discriminação",
  "Outro",
];

const STATUS = ["identificado", "em_tratamento", "controlado", "mitigado"];

function nivel(prob: number, sev: number) {
  const r = prob * sev;
  if (r >= 15) return { label: "Crítico", color: "bg-destructive text-destructive-foreground" };
  if (r >= 8) return { label: "Alto", color: "bg-orange-500 text-white" };
  if (r >= 4) return { label: "Médio", color: "bg-yellow-500 text-white" };
  return { label: "Baixo", color: "bg-emerald-600 text-white" };
}

export default function NR1Riscos() {
  const [riscos, setRiscos] = useState<any[]>([]);
  const [setores, setSetores] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({
    categoria: "", descricao: "", setor_id: "", probabilidade: 1, severidade: 1,
    status: "identificado", plano_acao: "",
  });

  const load = async () => {
    const [r, s] = await Promise.all([
      (supabase.from("nr1_riscos") as any).select("*").order("created_at", { ascending: false }),
      supabase.from("setores").select("id, nome").order("nome"),
    ]);
    setRiscos(r.data || []);
    setSetores(s.data || []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ categoria: "", descricao: "", setor_id: "", probabilidade: 1, severidade: 1, status: "identificado", plano_acao: "" });
    setOpen(true);
  };
  const openEdit = (r: any) => {
    setEditing(r);
    setForm({ ...r, setor_id: r.setor_id || "" });
    setOpen(true);
  };

  const salvar = async () => {
    if (!form.categoria || !form.descricao) return toast.error("Preencha categoria e descrição");
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      categoria: form.categoria,
      descricao: form.descricao,
      setor_id: form.setor_id || null,
      probabilidade: Number(form.probabilidade),
      severidade: Number(form.severidade),
      status: form.status,
      plano_acao: form.plano_acao || null,
    };
    const res = editing
      ? await (supabase.from("nr1_riscos") as any).update(payload).eq("id", editing.id)
      : await (supabase.from("nr1_riscos") as any).insert({ ...payload, created_by: user?.id });
    if (res.error) return toast.error(res.error.message);
    toast.success("Risco salvo");
    setOpen(false); load();
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir este risco?")) return;
    const { error } = await (supabase.from("nr1_riscos") as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído"); load();
  };

  // Matriz 5x5
  const matriz: any[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
  riscos.forEach((r) => {
    const p = Math.min(5, Math.max(1, r.probabilidade)) - 1;
    const s = Math.min(5, Math.max(1, r.severidade)) - 1;
    matriz[p][s]++;
  });

  return (
    <div className="container mx-auto p-0 sm:p-2 lg:p-4 space-y-6">
      <div className="flex-wrap gap-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-medium leading-tight">Gestão de Riscos Psicossociais</h1>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Risco</Button>
      </div>

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="matriz">Matriz de Risco</TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          <Card className="shadow-elegant">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riscos.map((r) => {
                  const n = nivel(r.probabilidade, r.severidade);
                  const setorNome = setores.find((s) => s.id === r.setor_id)?.nome || "—";
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.categoria}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{r.descricao}</div>
                      </TableCell>
                      <TableCell>{setorNome}</TableCell>
                      <TableCell><Badge className={n.color}>{n.label}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => excluir(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!riscos.length && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum risco cadastrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="matriz">
          <Card className="p-6 shadow-elegant">
            <div className="text-sm text-muted-foreground mb-4">Probabilidade × Severidade — número de riscos por célula</div>
            <div className="grid grid-cols-6 gap-1 max-w-2xl">
              <div></div>
              {[1,2,3,4,5].map(s => <div key={s} className="text-center text-xs font-semibold">S{s}</div>)}
              {[5,4,3,2,1].map((p) => (
                <>
                  <div key={`p${p}`} className="text-xs font-semibold flex items-center justify-center">P{p}</div>
                  {[1,2,3,4,5].map((s) => {
                    const qtd = matriz[p-1][s-1];
                    const n = nivel(p, s);
                    return (
                      <div key={`${p}-${s}`} className={`${n.color} aspect-square flex items-center justify-center font-bold rounded`}>
                        {qtd || ""}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar Risco" : "Novo Risco"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Setor</Label>
              <Select value={form.setor_id} onValueChange={(v) => setForm({ ...form, setor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Todos / Não especificado" /></SelectTrigger>
                <SelectContent>{setores.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Probabilidade (1-5)</Label>
                <Input type="number" min={1} max={5} value={form.probabilidade} onChange={(e) => setForm({ ...form, probabilidade: e.target.value })} />
              </div>
              <div>
                <Label>Severidade (1-5)</Label>
                <Input type="number" min={1} max={5} value={form.severidade} onChange={(e) => setForm({ ...form, severidade: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plano de Ação</Label>
              <Textarea value={form.plano_acao} onChange={(e) => setForm({ ...form, plano_acao: e.target.value })} />
            </div>
            <Button onClick={salvar} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

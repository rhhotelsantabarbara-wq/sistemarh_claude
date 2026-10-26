import { useEffect, useState } from "react";
import { todayISO } from "@/lib/date";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListChecks, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const STATUS = ["pendente", "em_andamento", "concluida", "cancelada"];
const PRIORIDADES = ["baixa", "media", "alta", "critica"];
const ORIGENS = ["risco", "denuncia", "clima", "lideranca", "auditoria", "outro"];

export default function NR1Acoes() {
  const [acoes, setAcoes] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ titulo: "", descricao: "", responsavel_employee_id: "", prazo: "", status: "pendente", prioridade: "media", origem: "outro" });

  const load = async () => {
    const [a, e] = await Promise.all([
      (supabase.from("nr1_acoes_preventivas") as any).select("*").order("created_at", { ascending: false }),
      supabase.from("employees").select("id, nome_completo").neq("status", "demitido").order("nome_completo"),
    ]);
    setAcoes(a.data || []); setEmployees(e.data || []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ titulo: "", descricao: "", responsavel_employee_id: "", prazo: "", status: "pendente", prioridade: "media", origem: "outro" }); setOpen(true); };
  const openEdit = (a: any) => { setEditing(a); setForm({ ...a, responsavel_employee_id: a.responsavel_employee_id || "", prazo: a.prazo || "" }); setOpen(true); };

  const salvar = async () => {
    if (!form.titulo.trim()) return toast.error("Título obrigatório");
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      titulo: form.titulo, descricao: form.descricao || null,
      responsavel_employee_id: form.responsavel_employee_id || null,
      prazo: form.prazo || null, status: form.status, prioridade: form.prioridade, origem: form.origem,
      data_conclusao: form.status === "concluida" ? todayISO() : null,
    };
    const res = editing
      ? await (supabase.from("nr1_acoes_preventivas") as any).update(payload).eq("id", editing.id)
      : await (supabase.from("nr1_acoes_preventivas") as any).insert({ ...payload, created_by: user?.id });
    if (res.error) return toast.error(res.error.message);
    toast.success("Salvo"); setOpen(false); load();
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir?")) return;
    const { error } = await (supabase.from("nr1_acoes_preventivas") as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const prioColor: Record<string,string> = { baixa: "bg-emerald-600 text-white", media: "bg-yellow-500 text-white", alta: "bg-orange-500 text-white", critica: "bg-destructive text-destructive-foreground" };
  const statusColor: Record<string,string> = { pendente: "bg-muted", em_andamento: "bg-primary text-primary-foreground", concluida: "bg-emerald-600 text-white", cancelada: "bg-muted" };

  return (
    <div className="container mx-auto p-0 sm:p-2 lg:p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><ListChecks className="h-7 w-7 text-primary" /><h1 className="text-3xl font-bold">Ações Preventivas</h1></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Ação</Button>
      </div>

      <Card className="shadow-elegant">
        <Table>
          <TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Responsável</TableHead><TableHead>Prazo</TableHead><TableHead>Origem</TableHead><TableHead>Prioridade</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {acoes.map((a) => {
              const resp = employees.find((e) => e.id === a.responsavel_employee_id)?.nome_completo || "—";
              return (
                <TableRow key={a.id}>
                  <TableCell><div className="font-medium">{a.titulo}</div></TableCell>
                  <TableCell>{resp}</TableCell>
                  <TableCell>{a.prazo || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{a.origem}</Badge></TableCell>
                  <TableCell><Badge className={prioColor[a.prioridade]}>{a.prioridade}</Badge></TableCell>
                  <TableCell><Badge className={statusColor[a.status]}>{a.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => excluir(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!acoes.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma ação</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Ação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Responsável</Label>
                <Select value={form.responsavel_employee_id} onValueChange={(v) => setForm({ ...form, responsavel_employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.nome_completo}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Prazo</Label><Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Origem</Label>
                <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ORIGENS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={salvar} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

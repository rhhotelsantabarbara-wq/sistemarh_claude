import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpenCheck, Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function NR1Treinamentos() {
  const [trs, setTrs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [conclusoes, setConclusoes] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ titulo: "", descricao: "", categoria: "geral", carga_horaria: 0, obrigatorio: false, reciclagem_meses: "", youtube_video_id: "", ativo: true });

  const [concDialog, setConcDialog] = useState<any>(null);
  const [employeeSel, setEmployeeSel] = useState("");

  const load = async () => {
    const [t, e, c] = await Promise.all([
      (supabase.from("nr1_treinamentos") as any).select("*").order("created_at", { ascending: false }),
      supabase.from("employees").select("id, nome_completo").neq("status", "demitido").order("nome_completo"),
      (supabase.from("nr1_treinamento_conclusoes") as any).select("*"),
    ]);
    setTrs(t.data || []); setEmployees(e.data || []); setConclusoes(c.data || []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ titulo: "", descricao: "", categoria: "geral", carga_horaria: 0, obrigatorio: false, reciclagem_meses: "", youtube_video_id: "", ativo: true }); setOpen(true); };
  const openEdit = (t: any) => { setEditing(t); setForm({ ...t, reciclagem_meses: t.reciclagem_meses || "" }); setOpen(true); };

  const salvar = async () => {
    if (!form.titulo.trim()) return toast.error("Título obrigatório");
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      titulo: form.titulo, descricao: form.descricao || null, categoria: form.categoria,
      carga_horaria: Number(form.carga_horaria) || 0, obrigatorio: !!form.obrigatorio,
      reciclagem_meses: form.reciclagem_meses ? Number(form.reciclagem_meses) : null,
      youtube_video_id: form.youtube_video_id || null, ativo: !!form.ativo,
    };
    const res = editing
      ? await (supabase.from("nr1_treinamentos") as any).update(payload).eq("id", editing.id)
      : await (supabase.from("nr1_treinamentos") as any).insert({ ...payload, created_by: user?.id });
    if (res.error) return toast.error(res.error.message);
    toast.success("Salvo"); setOpen(false); load();
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir?")) return;
    const { error } = await (supabase.from("nr1_treinamentos") as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const registrarConclusao = async () => {
    if (!employeeSel || !concDialog) return;
    const { error } = await (supabase.from("nr1_treinamento_conclusoes") as any).insert({
      treinamento_id: concDialog.id, employee_id: employeeSel,
    });
    if (error) return toast.error(error.message);
    toast.success("Conclusão registrada"); setEmployeeSel(""); load();
  };

  return (
    <div className="container mx-auto p-0 sm:p-2 lg:p-4 space-y-6">
      <div className="flex-wrap gap-3 flex items-center justify-between">
        <div className="flex items-center gap-3"><BookOpenCheck className="h-7 w-7 text-primary" /><h1 className="text-3xl font-bold">Treinamentos NR-1</h1></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Treinamento</Button>
      </div>

      <Card className="shadow-elegant">
        <Table>
          <TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Categoria</TableHead><TableHead>Carga</TableHead><TableHead>Concluídos</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {trs.map((t) => {
              const qtd = conclusoes.filter((c) => c.treinamento_id === t.id).length;
              return (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.titulo}</div>
                    {t.obrigatorio && <Badge variant="destructive" className="mt-1">Obrigatório</Badge>}
                  </TableCell>
                  <TableCell>{t.categoria}</TableCell>
                  <TableCell>{t.carga_horaria}h</TableCell>
                  <TableCell>{qtd}</TableCell>
                  <TableCell><Badge variant={t.ativo ? "default" : "secondary"}>{t.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setConcDialog(t)}><CheckCircle2 className="h-4 w-4 mr-1" />Registrar</Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => excluir(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!trs.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum treinamento</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Treinamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Categoria</Label><Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} /></div>
              <div><Label>Carga (h)</Label><Input type="number" value={form.carga_horaria} onChange={(e) => setForm({ ...form, carga_horaria: e.target.value })} /></div>
              <div><Label>Reciclagem (meses)</Label><Input type="number" value={form.reciclagem_meses} onChange={(e) => setForm({ ...form, reciclagem_meses: e.target.value })} /></div>
            </div>
            <div><Label>YouTube Video ID</Label><Input value={form.youtube_video_id} onChange={(e) => setForm({ ...form, youtube_video_id: e.target.value })} placeholder="ex: dQw4w9WgXcQ" /></div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2"><Checkbox checked={form.obrigatorio} onCheckedChange={(v) => setForm({ ...form, obrigatorio: !!v })} />Obrigatório</label>
              <label className="flex items-center gap-2"><Checkbox checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: !!v })} />Ativo</label>
            </div>
            <Button onClick={salvar} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!concDialog} onOpenChange={() => setConcDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar conclusão — {concDialog?.titulo}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Funcionário</Label>
            <select className="w-full border rounded p-2 bg-background" value={employeeSel} onChange={(e) => setEmployeeSel(e.target.value)}>
              <option value="">Selecione...</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.nome_completo}</option>)}
            </select>
            <Button onClick={registrarConclusao} className="w-full">Registrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

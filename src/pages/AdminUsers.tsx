import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MODULES } from "@/lib/modules";
import { Loader2, Plus, Trash2, Pencil, ShieldCheck, UserPlus } from "lucide-react";

interface AdminUser {
  user_id: string;
  nome_completo: string;
  email: string;
  modules: string[];
}

export default function AdminUsers() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [openPromote, setOpenPromote] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const fetchAdmins = async () => {
    setLoading(true);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin_parcial");
    const ids = (roles || []).map((r: any) => r.user_id);
    if (ids.length === 0) {
      setAdmins([]); setLoading(false); return;
    }
    const [{ data: profiles }, { data: perms }] = await Promise.all([
      supabase.from("profiles").select("id, nome_completo, email").in("id", ids),
      supabase.from("admin_module_permissions").select("user_id, module_key").in("user_id", ids),
    ]);
    const list: AdminUser[] = (profiles || []).map((p: any) => ({
      user_id: p.id,
      nome_completo: p.nome_completo,
      email: p.email,
      modules: (perms || []).filter((x: any) => x.user_id === p.id).map((x: any) => x.module_key),
    }));
    setAdmins(list);
    setLoading(false);
  };

  useEffect(() => { fetchAdmins(); }, []);

  const handleRevoke = async (userId: string) => {
    if (!confirm("Revogar o acesso de administrador deste usuário? A conta de login será mantida, mas perderá os privilégios de admin.")) return;
    // Verifica se o usuário também é funcionário cadastrado
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    // Remove permissões de módulo
    await supabase.from("admin_module_permissions").delete().eq("user_id", userId);
    // Rebaixa papel: vira 'funcionario' se tem registro de funcionário, senão remove o papel
    if (emp) {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: "funcionario" })
        .eq("user_id", userId);
      if (error) return toast.error("Erro ao revogar acesso");
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin_parcial");
      if (error) return toast.error("Erro ao revogar acesso");
    }
    toast.success("Acesso de administrador revogado");
    fetchAdmins();
  };

  return (
    <div className="space-y-6">
      <div className="flex-wrap gap-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Administradores</h1>
            <p className="text-sm text-muted-foreground">Cadastre admins com acesso restrito a módulos específicos</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setOpenPromote(true)}>
            <UserPlus className="w-4 h-4 mr-2" /> Promover funcionário
          </Button>
          <Button onClick={() => setOpenCreate(true)}>
            <Plus className="w-4 h-4 mr-2" /> Novo Administrador
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : admins.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Nenhum administrador parcial cadastrado.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {admins.map((a) => (
            <Card key={a.user_id}>
              <CardContent className="flex-wrap py-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{a.nome_completo?.toUpperCase()}</div>
                  <div className="text-xs text-muted-foreground mb-2 break-all">{a.email}</div>
                  <div className="flex flex-wrap gap-1">
                    {a.modules.length === 0 ? (
                      <span className="text-xs text-destructive">Sem módulos liberados</span>
                    ) : a.modules.map((m) => {
                      const mod = MODULES.find((x) => x.key === m);
                      return <span key={m} className="text-[11px] bg-muted px-2 py-0.5 rounded">{mod?.label || m}</span>;
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(a)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleRevoke(a.user_id)} title="Revogar acesso de admin">
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateAdminDialog open={openCreate} onOpenChange={setOpenCreate} onSaved={fetchAdmins} />
      <PromoteEmployeeDialog open={openPromote} onOpenChange={setOpenPromote} onSaved={fetchAdmins} />
      <EditAdminDialog admin={editing} onOpenChange={(o) => !o && setEditing(null)} onSaved={fetchAdmins} />
    </div>
  );
}

function ModuleSelector({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const groups = Array.from(new Set(MODULES.map((m) => m.group)));
  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-2">
      {groups.map((g) => (
        <div key={g}>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">{g}</div>
          <div className="grid grid-cols-2 gap-2">
            {MODULES.filter((m) => m.group === g).map((m) => (
              <label key={m.key} className="flex items-center gap-2 text-sm p-2 rounded border hover:bg-accent cursor-pointer">
                <Checkbox checked={value.includes(m.key)} onCheckedChange={() => toggle(m.key)} />
                <span>{m.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CreateAdminDialog({ open, onOpenChange, onSaved }: any) {
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [modules, setModules] = useState<string[]>(["dashboard"]);
  const [loading, setLoading] = useState(false);

  const reset = () => { setNome(""); setCpf(""); setSenha(""); setModules(["dashboard"]); };

  const submit = async () => {
    if (!nome || !cpf || !senha) return toast.error("Preencha todos os campos");
    setLoading(true);
    const { error } = await supabase.functions.invoke("create-admin-parcial", {
      body: { nome_completo: nome, cpf, senha, modules },
    });
    setLoading(false);
    if (error) return toast.error(error.message || "Erro ao cadastrar");
    toast.success("Administrador cadastrado!");
    reset(); onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Novo Administrador</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome Completo</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>CPF (login)</Label><Input value={cpf} onChange={(e) => setCpf(e.target.value)} /></div>
            <div><Label>Senha</Label><Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
          </div>
          <div>
            <Label>Módulos liberados</Label>
            <div className="mt-2"><ModuleSelector value={modules} onChange={setModules} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={loading}>{loading ? "Salvando..." : "Cadastrar"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditAdminDialog({ admin, onOpenChange, onSaved }: any) {
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (admin) setModules(admin.modules); }, [admin]);

  if (!admin) return null;

  const submit = async () => {
    setLoading(true);
    await supabase.from("admin_module_permissions").delete().eq("user_id", admin.user_id);
    if (modules.length > 0) {
      await supabase.from("admin_module_permissions").insert(
        modules.map((m) => ({ user_id: admin.user_id, module_key: m }))
      );
    }
    setLoading(false);
    toast.success("Permissões atualizadas");
    onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={!!admin} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Editar Permissões — {admin.nome_completo?.toUpperCase()}</DialogTitle></DialogHeader>
        <ModuleSelector value={modules} onChange={setModules} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PromoteEmployeeDialog({ open, onOpenChange, onSaved }: any) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [search, setSearch] = useState("");
  const [modules, setModules] = useState<string[]>(["dashboard"]);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoadingList(true);
      const { data } = await supabase
        .from("employees")
        .select("id, nome_completo, cargo, user_id, status")
        .neq("status", "demitido")
        .not("user_id", "is", null)
        .order("nome_completo");
      setEmployees(data || []);
      setLoadingList(false);
    })();
  }, [open]);

  const reset = () => { setSelected(""); setSearch(""); setModules(["dashboard"]); };

  const submit = async () => {
    if (!selected) return toast.error("Selecione um funcionário");
    setLoading(true);
    const { error } = await supabase.functions.invoke("promote-employee-admin", {
      body: { employee_id: selected, modules },
    });
    setLoading(false);
    if (error) return toast.error(error.message || "Erro ao promover");
    toast.success("Funcionário promovido a administrador!");
    reset(); onOpenChange(false); onSaved();
  };

  const filtered = employees.filter((e) =>
    e.nome_completo?.toLowerCase().includes(search.toLowerCase()) ||
    e.cargo?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Promover Funcionário a Administrador</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Buscar funcionário</Label>
            <Input
              placeholder="Nome ou cargo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <Label>Selecione um funcionário (apenas com login criado)</Label>
            <div className="max-h-48 overflow-y-auto border rounded mt-1">
              {loadingList ? (
                <div className="p-4 text-center"><Loader2 className="w-4 h-4 animate-spin inline" /></div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Nenhum funcionário encontrado</div>
              ) : filtered.map((e) => (
                <label key={e.id} className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-accent ${selected === e.id ? "bg-accent" : ""}`}>
                  <input
                    type="radio"
                    name="emp"
                    checked={selected === e.id}
                    onChange={() => setSelected(e.id)}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{e.nome_completo?.toUpperCase()}</div>
                    <div className="text-xs text-muted-foreground">{e.cargo}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Módulos liberados</Label>
            <div className="mt-2"><ModuleSelector value={modules} onChange={setModules} /></div>
          </div>
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            ℹ️ Ao promover, o funcionário perderá o acesso ao painel de funcionário e passará a ter acesso de administrador parcial aos módulos selecionados (mesmo login/senha).
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={loading}>{loading ? "Promovendo..." : "Promover"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

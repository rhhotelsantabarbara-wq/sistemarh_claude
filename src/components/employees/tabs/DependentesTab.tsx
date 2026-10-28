import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { PARENTESCO } from "@/lib/fichaCampos";
import { dataBR, todayISO } from "@/lib/date";

const db = supabase as any;

export interface Dependente {
  id?: string;
  nome: string;
  cpf?: string | null;
  data_nascimento?: string | null;
  parentesco?: string | null;
  dependente_ir?: boolean;
  salario_familia?: boolean;
  plano_saude?: boolean;
}

export const idade = (nasc?: string | null) => {
  if (!nasc) return null;
  const n = dataBR(nasc);
  const h = dataBR(todayISO());
  let a = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a--;
  return a;
};

const VAZIO: Dependente = { nome: "", cpf: "", data_nascimento: "", parentesco: "", dependente_ir: false, salario_familia: false, plano_saude: false };

/** Formulário de um dependente (usado aqui e na admissão por link) */
export const DependenteCampos = ({ valor, onChange, simples }: { valor: Dependente; onChange: (d: Dependente) => void; simples?: boolean }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <div className="sm:col-span-2">
      <Label htmlFor="dep-nome" className="mb-1.5 block">Nome completo *</Label>
      <Input id="dep-nome" value={valor.nome} onChange={(e) => onChange({ ...valor, nome: e.target.value })} />
    </div>
    <div>
      <Label htmlFor="dep-par" className="mb-1.5 block">Parentesco</Label>
      <Select value={valor.parentesco || ""} onValueChange={(x) => onChange({ ...valor, parentesco: x })}>
        <SelectTrigger id="dep-par"><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>{PARENTESCO.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <div>
      <Label htmlFor="dep-nasc" className="mb-1.5 block">Data de nascimento</Label>
      <Input id="dep-nasc" type="date" value={valor.data_nascimento || ""} onChange={(e) => onChange({ ...valor, data_nascimento: e.target.value })} />
    </div>
    <div className="sm:col-span-2">
      <Label htmlFor="dep-cpf" className="mb-1.5 block">CPF</Label>
      <Input id="dep-cpf" inputMode="numeric" value={valor.cpf || ""} onChange={(e) => onChange({ ...valor, cpf: e.target.value })} placeholder="000.000.000-00" />
    </div>
    {!simples && ([
      ["dependente_ir", "Dependente no Imposto de Renda"],
      ["salario_familia", "Recebe salário-família"],
      ["plano_saude", "Incluído no plano de saúde"],
    ] as const).map(([k, rot]) => (
      <div key={k} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 sm:col-span-2">
        <Label htmlFor={`dep-${k}`} className="font-normal">{rot}</Label>
        <Switch id={`dep-${k}`} checked={!!valor[k]} onCheckedChange={(x) => onChange({ ...valor, [k]: x })} />
      </div>
    ))}
  </div>
);

const DependentesTab = ({ employeeId }: { employeeId: string }) => {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<Dependente | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ["dependentes", employeeId],
    queryFn: async () => {
      const { data, error } = await db.from("employee_dependentes").select("*").eq("employee_id", employeeId).order("data_nascimento");
      if (error) throw error;
      return (data || []) as Dependente[];
    },
  });

  const salvar = async () => {
    if (!editando?.nome.trim()) return toast.error("Informe o nome do dependente");
    setSalvando(true);
    const registro = {
      employee_id: employeeId,
      nome: editando.nome.trim(),
      cpf: editando.cpf || null,
      data_nascimento: editando.data_nascimento || null,
      parentesco: editando.parentesco || null,
      dependente_ir: !!editando.dependente_ir,
      salario_familia: !!editando.salario_familia,
      plano_saude: !!editando.plano_saude,
    };
    const { error } = editando.id
      ? await db.from("employee_dependentes").update(registro).eq("id", editando.id)
      : await db.from("employee_dependentes").insert(registro);
    setSalvando(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Dependente salvo");
    setEditando(null);
    qc.invalidateQueries({ queryKey: ["dependentes", employeeId] });
  };

  const excluir = async (d: Dependente) => {
    if (!confirm(`Remover ${d.nome} dos dependentes?`)) return;
    const { error } = await db.from("employee_dependentes").delete().eq("id", d.id);
    if (error) return toast.error("Erro ao remover: " + error.message);
    qc.invalidateQueries({ queryKey: ["dependentes", employeeId] });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5" /> Dependentes</CardTitle>
        <Button size="sm" onClick={() => setEditando({ ...VAZIO })}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : lista.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Nenhum dependente cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {lista.map((d) => {
              const anos = idade(d.data_nascimento);
              return (
                <div key={d.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{d.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {[d.parentesco, anos !== null ? `${anos} ${anos === 1 ? "ano" : "anos"}` : null, d.cpf ? `CPF ${d.cpf}` : null].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {d.dependente_ir && <Badge variant="secondary">IR</Badge>}
                      {d.salario_familia && <Badge variant="secondary">Salário-família</Badge>}
                      {d.plano_saude && <Badge variant="secondary">Plano de saúde</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 self-end sm:self-auto">
                    <Button variant="outline" size="sm" onClick={() => setEditando({ ...d })} aria-label={`Editar ${d.nome}`}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => excluir(d)} aria-label={`Remover ${d.nome}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editando?.id ? "Editar dependente" : "Novo dependente"}</DialogTitle></DialogHeader>
          {editando && <DependenteCampos valor={editando} onChange={setEditando} />}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default DependentesTab;

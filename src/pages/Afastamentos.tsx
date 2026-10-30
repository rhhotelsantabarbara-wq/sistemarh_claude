import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { abrirDocumentoAfastamento } from "@/components/afastamentos/AtestadosRecebidos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Eye, Download, Search, Stethoscope } from "lucide-react";
import PageHeader, { BOTAO_PRINCIPAL, Indicador } from "@/components/layout/PageHeader";
import AbsenceForm from "@/components/forms/AbsenceForm";
import AtestadosRecebidos from "@/components/afastamentos/AtestadosRecebidos";
import { formatDateOnlyPtBR, todayISO } from "@/lib/date";

interface EmployeeOption {
  id: string;
  nome_completo: string;
  cargo: string | null;
  setor: string | null;
}

const Afastamentos = () => {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [afastamentos, setAfastamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [busca, setBusca] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: emps }, { data: afs }] = await Promise.all([
      supabase
        .from("employees")
        .select("id, nome_completo, cargo, setor")
        .neq("status", "demitido")
        .order("nome_completo"),
      supabase
        .from("afastamentos")
        .select("*, employees(nome_completo, cargo, setor)")
        .order("data_inicio", { ascending: false }),
    ]);
    setEmployees(emps || []);
    setAfastamentos(afs || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const hoje = todayISO();

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return afastamentos;
    return afastamentos.filter((a) => {
      const nome = (a.employees?.nome_completo || "").toLowerCase();
      const motivo = (a.motivo || "").toLowerCase();
      const cid = (a.cid || "").toLowerCase();
      return nome.includes(termo) || motivo.includes(termo) || cid.includes(termo);
    });
  }, [afastamentos, busca]);

  const diasDe = (a: any) => {
    if (!a.data_inicio || !a.data_fim) return 0;
    return Math.round((Date.parse(a.data_fim) - Date.parse(a.data_inicio)) / 86400000) + 1;
  };

  const emAndamento = (a: any) =>
    a.data_inicio <= hoje && (!a.data_fim || a.data_fim >= hoje);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Afastamentos e atestados"
        descricao="Registre e acompanhe afastamentos e atestados médicos dos colaboradores"
        icone={Stethoscope}
        acoes={<Button className={BOTAO_PRINCIPAL} onClick={() => setShowForm((v) => !v)}><Plus className="h-4 w-4" />Registrar afastamento</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Indicador rotulo="Afastados hoje" valor={afastamentos.filter(emAndamento).length} faixa="border-l-rose-400" cor="text-rose-700" />
        <Indicador rotulo="Neste mês" valor={afastamentos.filter((a) => (a.data_inicio || "").slice(0, 7) === hoje.slice(0, 7)).length} faixa="border-l-primary" cor="text-primary" />
        <Indicador rotulo="Dias de afastamento no mês" valor={afastamentos.filter((a) => (a.data_inicio || "").slice(0, 7) === hoje.slice(0, 7)).reduce((t, a) => t + diasDe(a), 0)} faixa="border-l-amber-400" />
      </div>

      <AtestadosRecebidos onAprovado={fetchAll} />

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Novo Afastamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_completo.toUpperCase()}
                      {e.cargo ? ` — ${e.cargo}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEmployee ? (
              <AbsenceForm
                employeeId={selectedEmployee}
                onSaved={() => {
                  setShowForm(false);
                  setSelectedEmployee("");
                  fetchAll();
                }}
                onCancel={() => {
                  setShowForm(false);
                  setSelectedEmployee("");
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione um colaborador para continuar.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          aria-label="Buscar afastamento"
          className="h-10 rounded-full border-0 bg-[hsl(228_14%_92%)] pl-10"
          placeholder="Buscar por colaborador, motivo ou CID"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum afastamento registrado
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_70px_auto] gap-4 px-5 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground lg:grid">
            <div>Colaborador</div><div>Motivo</div><div>Período</div><div>Dias</div><div className="w-[150px]" />
          </div>
          {filtrados.map((a) => {
            const ativo = emAndamento(a);
            return (
              <div key={a.id} className={`grid grid-cols-1 gap-3 rounded-lg border-l-4 ${ativo ? "border-l-rose-400" : "border-l-slate-200"} bg-card px-4 py-3 shadow-[0_1px_2px_rgba(20,24,40,0.06)] lg:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_70px_auto] lg:items-center lg:gap-4`}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                    {String(a.employees?.nome_completo || "?").split(" ").filter(Boolean).map((p: string, k: number, arr: string[]) => (k === 0 || k === arr.length - 1 ? p[0] : "")).join("").toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="truncate">{a.employees?.nome_completo || "Colaborador"}</span>
                      {ativo && <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-rose-700">Afastado agora</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{[a.employees?.cargo, a.employees?.setor].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
                <div className="min-w-0 text-sm">
                  <span className="break-words">{a.motivo}</span>
                  {a.cid && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">CID {a.cid}</span>}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDateOnlyPtBR(a.data_inicio)}{a.data_fim ? ` a ${formatDateOnlyPtBR(a.data_fim)}` : ""}
                </div>
                <div className="text-sm"><span className="font-medium tabular-nums">{diasDe(a) || "—"}</span><span className="text-muted-foreground lg:hidden"> dias</span></div>
                <div className="flex gap-2 lg:w-[150px] lg:justify-end">
                  {a.documento_url ? (
                    <>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => abrirDocumentoAfastamento(a.documento_url)}><Eye className="h-3.5 w-3.5" />Ver</Button>
                      <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Baixar documento" onClick={() => abrirDocumentoAfastamento(a.documento_url, true)}><Download className="h-3.5 w-3.5" /></Button>
                    </>
                  ) : <span className="text-xs text-muted-foreground">Sem anexo</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Afastamentos;

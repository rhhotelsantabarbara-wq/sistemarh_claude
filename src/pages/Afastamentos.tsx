import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { abrirDocumentoAfastamento } from "@/components/afastamentos/AtestadosRecebidos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Eye, Download, Search } from "lucide-react";
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

  const emAndamento = (a: any) =>
    a.data_inicio <= hoje && (!a.data_fim || a.data_fim >= hoje);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Afastamentos / Atestados</h1>
          <p className="text-sm text-muted-foreground">
            Registre e acompanhe afastamentos e atestados médicos dos colaboradores
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4 mr-2" />
          Registrar Afastamento
        </Button>
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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
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
        <div className="grid gap-4 md:grid-cols-2">
          {filtrados.map((a) => (
            <Card key={a.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {(a.employees?.nome_completo || "Colaborador").toUpperCase()}
                  </span>
                  {emAndamento(a) && <Badge>Em andamento</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground">Início</p>
                    <p className="font-medium">{formatDateOnlyPtBR(a.data_inicio)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fim</p>
                    <p className="font-medium">
                      {a.data_fim ? formatDateOnlyPtBR(a.data_fim) : "—"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Motivo</p>
                  <p className="font-medium">{a.motivo}</p>
                </div>
                {a.cid && (
                  <div>
                    <p className="text-muted-foreground">CID</p>
                    <p className="font-medium">{a.cid}</p>
                  </div>
                )}
                {a.documento_url && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirDocumentoAfastamento(a.documento_url)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Visualizar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirDocumentoAfastamento(a.documento_url, true)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Baixar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Afastamentos;

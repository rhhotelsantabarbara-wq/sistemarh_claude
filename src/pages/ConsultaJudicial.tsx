import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Scale, Search, Loader2, CheckCircle, AlertTriangle, RefreshCw, History } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Employee {
  id: string;
  nome_completo: string;
  cpf: string | null;
  cargo: string;
  setor: string | null;
  status: string | null;
}

interface ConsultaResult {
  id: string;
  employee_id: string;
  data_consulta: string;
  processos_encontrados: number;
  resumo: string | null;
  resultado: any;
}

export default function ConsultaJudicial() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [consultas, setConsultas] = useState<Record<string, ConsultaResult>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [consultingId, setConsultingId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [detailDialog, setDetailDialog] = useState<ConsultaResult | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [empRes, consultaRes] = await Promise.all([
      supabase
        .from("employees")
        .select("id, nome_completo, cpf, cargo, setor, status")
        .in("status", ["ativo", "ferias"])
        .not("cpf", "is", null)
        .order("nome_completo"),
      supabase
        .from("consultas_judiciais")
        .select("*")
        .order("data_consulta", { ascending: false }),
    ]);

    if (empRes.data) setEmployees(empRes.data);

    if (consultaRes.data) {
      const map: Record<string, ConsultaResult> = {};
      for (const c of consultaRes.data) {
        if (!map[c.employee_id]) {
          map[c.employee_id] = c as ConsultaResult;
        }
      }
      setConsultas(map);
    }
    setLoading(false);
  };

  const consultarFuncionario = async (emp: Employee) => {
    if (!emp.cpf) {
      toast.error("Funcionário sem CPF cadastrado");
      return;
    }

    setConsultingId(emp.id);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase.functions.invoke("consulta-judicial", {
        body: {
          employee_id: emp.id,
          cpf: emp.cpf,
          nome: emp.nome_completo,
          consultado_por: userData.user?.id,
        },
      });

      if (error) {
        let msg = error.message;
        try { msg = (await (error as any).context?.json())?.error || msg; } catch { /* mantém a mensagem */ }
        throw new Error(msg);
      }

      toast.success(
        data.processos_encontrados > 0
          ? `${data.processos_encontrados} processo(s) encontrado(s) para ${emp.nome_completo}`
          : `Nenhum processo encontrado para ${emp.nome_completo}`
      );

      await loadData();
    } catch (error: any) {
      console.error("Erro na consulta:", error);
      toast.error("Erro ao consultar: " + (error.message || "Erro desconhecido"));
    } finally {
      setConsultingId(null);
    }
  };

  const consultarTodos = async () => {
    const filtered = filteredEmployees;
    setBatchProgress({ current: 0, total: filtered.length });

    for (let i = 0; i < filtered.length; i++) {
      setBatchProgress({ current: i + 1, total: filtered.length });
      await consultarFuncionario(filtered[i]);
      // Small delay between requests
      if (i < filtered.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    setBatchProgress(null);
    toast.success("Consulta em lote finalizada!");
  };

  const filteredEmployees = employees.filter(
    (e) =>
      e.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.cpf && e.cpf.includes(searchTerm))
  );

  const totalConsultados = Object.keys(consultas).length;
  const totalComProcesso = Object.values(consultas).filter((c) => c.processos_encontrados > 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6" />
            Consulta Judicial
          </h1>
          <p className="text-muted-foreground text-sm">
            Verifique se colaboradores estão envolvidos em processos judiciais
          </p>
        </div>
        <Button
          onClick={consultarTodos}
          disabled={!!consultingId || !!batchProgress}
          variant="outline"
        >
          {batchProgress ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {batchProgress.current}/{batchProgress.total}
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Consultar Todos
            </>
          )}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{employees.length}</div>
            <p className="text-sm text-muted-foreground">Colaboradores com CPF</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalConsultados}</div>
            <p className="text-sm text-muted-foreground">Já consultados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">{totalComProcesso}</div>
            <p className="text-sm text-muted-foreground">Com processos encontrados</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou CPF..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Colaboradores</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Última Consulta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((emp) => {
                const consulta = consultas[emp.id];
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.nome_completo}</TableCell>
                    <TableCell className="font-mono text-sm">{emp.cpf}</TableCell>
                    <TableCell>{emp.cargo}</TableCell>
                    <TableCell>
                      {consulta ? (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(consulta.data_consulta), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Nunca</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {consulta ? (
                        consulta.processos_encontrados > 0 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {consulta.processos_encontrados} processo(s)
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <CheckCircle className="h-3 w-3" />
                            Sem processos
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline">Não consultado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {consulta && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDetailDialog(consulta)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => consultarFuncionario(emp)}
                        disabled={consultingId === emp.id || !!batchProgress}
                      >
                        {consultingId === emp.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Search className="h-4 w-4 mr-1" />
                            Consultar
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredEmployees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum colaborador encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Consulta</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {detailDialog && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Data da consulta</p>
                  <p className="font-medium">
                    {format(new Date(detailDialog.data_consulta), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Processos encontrados</p>
                  <p className="font-medium">{detailDialog.processos_encontrados}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Resumo</p>
                  <p className="text-sm">{detailDialog.resumo || "Sem resumo disponível"}</p>
                </div>
                {detailDialog.resultado?.processos?.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Processos</p>
                    <div className="space-y-2">
                      {detailDialog.resultado.processos.map((p: any, i: number) => (
                        <Card key={i}>
                          <CardContent className="pt-4 text-sm space-y-1">
                            {p.numero_processo && <p><strong>Nº:</strong> {p.numero_processo}</p>}
                            {p.tribunal && <p><strong>Tribunal:</strong> {p.tribunal}</p>}
                            {p.tipo && <p><strong>Tipo:</strong> {p.tipo}</p>}
                            {p.status && <p><strong>Status:</strong> {p.status}</p>}
                            {p.polo && <p><strong>Polo:</strong> {p.polo}</p>}
                            {p.resumo && <p><strong>Resumo:</strong> {p.resumo}</p>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
                {detailDialog.resultado?.fontes?.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Fontes</p>
                    <ul className="text-xs space-y-1">
                      {detailDialog.resultado.fontes.map((f: string, i: number) => (
                        <li key={i}>
                          <a href={f} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
                            {f}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

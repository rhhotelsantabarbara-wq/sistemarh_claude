import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, RefreshCw, Trash2, Clock, History, Users } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { dataBR } from "@/lib/date";

export function BancoHoras() {
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [observacao, setObservacao] = useState("");
  const queryClient = useQueryClient();

  const { data: employees, isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees-banco-horas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome_completo, cargo, setor")
        .in("status", ["ativo", "ferias"])
        .order("nome_completo");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: bancoHoras, isLoading: loadingBanco } = useQuery({
    queryKey: ["banco-horas", selectedEmployee],
    queryFn: async () => {
      if (!selectedEmployee) return null;
      
      const { data, error } = await supabase
        .from("banco_horas")
        .select("*")
        .eq("employee_id", selectedEmployee)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEmployee,
  });

  const { data: saldoMes } = useQuery({
    queryKey: ["saldo-mes", selectedEmployee, selectedMonth],
    queryFn: async () => {
      if (!selectedEmployee || !selectedMonth) return null;
      
      const [year, month] = selectedMonth.split("-");
      const startDate = format(startOfMonth(new Date(parseInt(year), parseInt(month) - 1)), "yyyy-MM-dd");
      const endDate = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), "yyyy-MM-dd");
      
      const { data: registros } = await supabase
        .from("registros_ponto")
        .select("*")
        .eq("employee_id", selectedEmployee)
        .gte("data", startDate)
        .lte("data", endDate);

      const { data: config } = await supabase
        .from("configuracao_horas_trabalho")
        .select("*")
        .eq("employee_id", selectedEmployee)
        .maybeSingle();

      const horasDiarias = config?.horas_diarias_esperadas || 8.00;
      const diasUteis = registros?.filter(r => r.tipo_dia === "normal").length || 0;
      const horasEsperadas = diasUteis * horasDiarias;
      const horasTrabalhadas = registros?.reduce((sum, r) => sum + (r.horas_trabalhadas || 0), 0) || 0;
      const saldo = horasTrabalhadas - horasEsperadas;

      return saldo;
    },
    enabled: !!selectedEmployee && !!selectedMonth,
  });

  const { data: historico } = useQuery({
    queryKey: ["historico-banco-horas", selectedEmployee],
    queryFn: async () => {
      if (!selectedEmployee) return [];
      
      const { data, error } = await supabase
        .from("historico_banco_horas")
        .select("*, created_by:profiles(nome_completo)")
        .eq("employee_id", selectedEmployee)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEmployee,
  });

  const adicionarSaldoMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployee || saldoMes === null || saldoMes === undefined) {
        throw new Error("Selecione um funcionário e mês válidos");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const saldoAtual = bancoHoras?.saldo_horas || 0;
      const novoSaldo = saldoAtual + saldoMes;

      // Atualizar ou inserir no banco de horas
      const { error: bancoError } = await supabase
        .from("banco_horas")
        .upsert({
          employee_id: selectedEmployee,
          saldo_horas: novoSaldo,
        }, { onConflict: 'employee_id' });

      if (bancoError) throw bancoError;

      // Registrar no histórico
      const { error: histError } = await supabase
        .from("historico_banco_horas")
        .insert({
          employee_id: selectedEmployee,
          tipo_movimentacao: "adicao",
          horas: saldoMes,
          saldo_anterior: saldoAtual,
          saldo_novo: novoSaldo,
          mes_referencia: selectedMonth,
          observacao: observacao || null,
          created_by: user.id,
        });

      if (histError) throw histError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banco-horas"] });
      queryClient.invalidateQueries({ queryKey: ["historico-banco-horas"] });
      toast.success("Saldo adicionado ao banco de horas!");
      setObservacao("");
    },
    onError: (error) => {
      console.error("Erro ao adicionar saldo:", error);
      toast.error("Erro ao adicionar saldo ao banco de horas");
    },
  });

  const zerarBancoMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployee) throw new Error("Selecione um funcionário");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const saldoAtual = bancoHoras?.saldo_horas || 0;

      // Atualizar banco de horas para zero
      const { error: bancoError } = await supabase
        .from("banco_horas")
        .upsert({
          employee_id: selectedEmployee,
          saldo_horas: 0,
        }, { onConflict: 'employee_id' });

      if (bancoError) throw bancoError;

      // Registrar no histórico
      const { error: histError } = await supabase
        .from("historico_banco_horas")
        .insert({
          employee_id: selectedEmployee,
          tipo_movimentacao: "zerado",
          horas: saldoAtual,
          saldo_anterior: saldoAtual,
          saldo_novo: 0,
          observacao: observacao || null,
          created_by: user.id,
        });

      if (histError) throw histError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banco-horas"] });
      queryClient.invalidateQueries({ queryKey: ["historico-banco-horas"] });
      toast.success("Banco de horas zerado!");
      setObservacao("");
    },
    onError: (error) => {
      console.error("Erro ao zerar banco:", error);
      toast.error("Erro ao zerar banco de horas");
    },
  });

  const adicionarTodosMutation = useMutation({
    mutationFn: async () => {
      if (!employees || employees.length === 0) throw new Error("Nenhum funcionário encontrado");
      if (!selectedMonth) throw new Error("Selecione um mês");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const [year, month] = selectedMonth.split("-");
      const startDate = format(startOfMonth(new Date(parseInt(year), parseInt(month) - 1)), "yyyy-MM-dd");
      const endDate = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), "yyyy-MM-dd");

      let successCount = 0;
      let errorCount = 0;

      for (const emp of employees) {
        try {
          // Buscar registros do mês
          const { data: registros } = await supabase
            .from("registros_ponto")
            .select("*")
            .eq("employee_id", emp.id)
            .gte("data", startDate)
            .lte("data", endDate);

          const { data: config } = await supabase
            .from("configuracao_horas_trabalho")
            .select("*")
            .eq("employee_id", emp.id)
            .maybeSingle();

          const horasDiarias = config?.horas_diarias_esperadas || 8.00;
          const diasUteis = registros?.filter(r => r.tipo_dia === "normal").length || 0;
          const horasEsperadas = diasUteis * horasDiarias;
          const horasTrabalhadas = registros?.reduce((sum, r) => sum + (r.horas_trabalhadas || 0), 0) || 0;
          const saldoMesEmp = horasTrabalhadas - horasEsperadas;

          if (saldoMesEmp === 0) continue;

          // Buscar saldo atual
          const { data: bancoAtual } = await supabase
            .from("banco_horas")
            .select("saldo_horas")
            .eq("employee_id", emp.id)
            .maybeSingle();

          const saldoAtual = bancoAtual?.saldo_horas || 0;
          const novoSaldo = saldoAtual + saldoMesEmp;

          const { error: bancoError } = await supabase
            .from("banco_horas")
            .upsert({
              employee_id: emp.id,
              saldo_horas: novoSaldo,
            }, { onConflict: 'employee_id' });

          if (bancoError) throw bancoError;

          await supabase
            .from("historico_banco_horas")
            .insert({
              employee_id: emp.id,
              tipo_movimentacao: "adicao",
              horas: saldoMesEmp,
              saldo_anterior: saldoAtual,
              saldo_novo: novoSaldo,
              mes_referencia: selectedMonth,
              observacao: observacao || "Adição em lote",
              created_by: user.id,
            });

          successCount++;
        } catch (err) {
          console.error(`Erro ao processar ${emp.nome_completo}:`, err);
          errorCount++;
        }
      }

      return { successCount, errorCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["banco-horas"] });
      queryClient.invalidateQueries({ queryKey: ["historico-banco-horas"] });
      toast.success(`Saldo adicionado para ${result.successCount} funcionário(s)${result.errorCount > 0 ? `. ${result.errorCount} erro(s).` : ""}`);
      setObservacao("");
    },
    onError: (error) => {
      console.error("Erro ao adicionar saldo em lote:", error);
      toast.error("Erro ao adicionar saldo em lote");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-4">Banco de Horas</h2>
        <p className="text-muted-foreground">
          Gerencie o banco de horas dos funcionários
        </p>
      </div>

      <Tabs defaultValue="gerenciar" className="space-y-6">
        <TabsList>
          <TabsTrigger value="gerenciar" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Gerenciar Banco
          </TabsTrigger>
          <TabsTrigger value="lote" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Adicionar Todos
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gerenciar" className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="employee">Selecione o Funcionário</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um funcionário" />
              </SelectTrigger>
              <SelectContent>
                {employees?.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome_completo} - {emp.cargo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedEmployee && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Saldo Atual no Banco</CardTitle>
                  <CardDescription>Horas acumuladas no banco de horas</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingBanco ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <div className="text-3xl font-bold">
                      {bancoHoras?.saldo_horas?.toFixed(2) || "0.00"}h
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Adicionar Saldo do Mês</CardTitle>
                  <CardDescription>
                    Transfira o saldo de horas de um mês específico para o banco de horas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="month">Selecione o Mês</Label>
                    <Input
                      id="month"
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                    />
                  </div>

                  {saldoMes !== null && saldoMes !== undefined && (
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Saldo do mês selecionado:</p>
                      <p className={`text-2xl font-bold ${saldoMes > 0 ? 'text-green-600' : saldoMes < 0 ? 'text-red-600' : ''}`}>
                        {saldoMes > 0 ? '+' : ''}{saldoMes.toFixed(2)}h
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="observacao">Observação (opcional)</Label>
                    <Textarea
                      id="observacao"
                      placeholder="Adicione uma observação sobre esta movimentação"
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={() => adicionarSaldoMutation.mutate()}
                    disabled={adicionarSaldoMutation.isPending || saldoMes === null || saldoMes === 0}
                    className="w-full"
                  >
                    {adicionarSaldoMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Adicionar ao Banco de Horas
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive">Zerar Banco de Horas</CardTitle>
                  <CardDescription>
                    Esta ação irá zerar todas as horas acumuladas no banco
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="observacao-zerar">Observação (opcional)</Label>
                    <Textarea
                      id="observacao-zerar"
                      placeholder="Motivo para zerar o banco de horas"
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                    />
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="w-full"
                        disabled={!bancoHoras || bancoHoras.saldo_horas === 0}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Zerar Banco de Horas
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Zeragem do Banco</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja zerar o banco de horas? Esta ação não pode ser desfeita.
                          Saldo atual: {bancoHoras?.saldo_horas?.toFixed(2) || "0.00"}h
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => zerarBancoMutation.mutate()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Confirmar Zeragem
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="lote" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Adicionar Saldo de Todos os Funcionários</CardTitle>
              <CardDescription>
                Calcule e adicione o saldo do mês selecionado ao banco de horas de todos os funcionários ativos de uma vez
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="month-lote">Selecione o Mês</Label>
                <Input
                  id="month-lote"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacao-lote">Observação (opcional)</Label>
                <Textarea
                  id="observacao-lote"
                  placeholder="Observação para todos os registros"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </div>

              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  <strong>{employees?.length || 0}</strong> funcionários ativos serão processados.
                  O saldo de horas do mês <strong>{selectedMonth}</strong> será calculado e adicionado ao banco de cada um.
                </p>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="w-full"
                    disabled={adicionarTodosMutation.isPending || !employees?.length}
                  >
                    {adicionarTodosMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Users className="mr-2 h-4 w-4" />
                    )}
                    Adicionar Saldo de Todos
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Adição em Lote</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja adicionar o saldo do mês {selectedMonth} ao banco de horas de todos os {employees?.length || 0} funcionários ativos?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => adicionarTodosMutation.mutate()}>
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="employee-historico">Selecione o Funcionário</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um funcionário" />
              </SelectTrigger>
              <SelectContent>
                {employees?.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome_completo} - {emp.cargo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedEmployee && historico && historico.length > 0 && (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead>Saldo Anterior</TableHead>
                    <TableHead>Saldo Novo</TableHead>
                    <TableHead>Mês Ref.</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {format(dataBR(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.tipo_movimentacao === "adicao"
                              ? "default"
                              : item.tipo_movimentacao === "zerado"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {item.tipo_movimentacao === "adicao"
                            ? "Adição"
                            : item.tipo_movimentacao === "zerado"
                            ? "Zerado"
                            : "Uso"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {item.horas > 0 ? '+' : ''}{item.horas.toFixed(2)}h
                      </TableCell>
                      <TableCell>{item.saldo_anterior.toFixed(2)}h</TableCell>
                      <TableCell className="font-semibold">
                        {item.saldo_novo.toFixed(2)}h
                      </TableCell>
                      <TableCell>{item.mes_referencia || "-"}</TableCell>
                      <TableCell>
                        {(item.created_by as any)?.nome_completo || "-"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {item.observacao || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {selectedEmployee && (!historico || historico.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum histórico encontrado para este funcionário
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

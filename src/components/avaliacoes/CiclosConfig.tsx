import { useState } from "react";
import { parseDateOnly, dataBR } from "@/lib/date";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, Play, Pause, Trash2, Plus, History } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const CiclosConfig = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    nome: "",
    tipo: "mensal",
    data_inicio: "",
    empresa_id: "all",
    setor_id: "all",
    funcao_id: "all",
    dias_para_conclusao: 30,
    criar_metas: false,
  });

  const { data: ciclos } = useQuery({
    queryKey: ["ciclos-avaliacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ciclos_avaliacao")
        .select("*, empresas(nome), setores(nome), funcoes(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: setores } = useQuery({
    queryKey: ["setores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("setores").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: funcoes } = useQuery({
    queryKey: ["funcoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("funcoes").select("*");
      if (error) throw error;
      return data;
    },
  });

  const createCiclo = useMutation({
    mutationFn: async (data: typeof formData) => {
      const dataInicio = (parseDateOnly(data.data_inicio) ?? new Date());
      const { error } = await supabase.from("ciclos_avaliacao").insert({
        ...data,
        data_proxima_execucao: data.data_inicio,
        empresa_id: data.empresa_id === "all" ? null : data.empresa_id,
        setor_id: data.setor_id === "all" ? null : data.setor_id,
        funcao_id: data.funcao_id === "all" ? null : data.funcao_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ciclos-avaliacao"] });
      toast.success("Ciclo criado com sucesso!");
      setIsDialogOpen(false);
      setFormData({
        nome: "",
        tipo: "mensal",
        data_inicio: "",
        empresa_id: "all",
        setor_id: "all",
        funcao_id: "all",
        dias_para_conclusao: 30,
        criar_metas: false,
      });
    },
    onError: () => toast.error("Erro ao criar ciclo"),
  });

  const toggleCiclo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("ciclos_avaliacao")
        .update({ ativo: !ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ciclos-avaliacao"] });
      toast.success("Status do ciclo atualizado!");
    },
  });

  const deleteCiclo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ciclos_avaliacao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ciclos-avaliacao"] });
      toast.success("Ciclo excluído!");
    },
  });

  const executarCiclo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("processar-ciclos-avaliacao");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacoes"] });
      toast.success("Ciclos processados com sucesso!");
    },
    onError: () => toast.error("Erro ao processar ciclos"),
  });

  const { data: execucoes } = useQuery({
    queryKey: ["execucoes-ciclo", showHistory],
    queryFn: async () => {
      if (!showHistory) return [];
      const { data, error } = await supabase
        .from("execucoes_ciclo")
        .select("*")
        .eq("ciclo_id", showHistory)
        .order("data_execucao", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!showHistory,
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Ciclos Automáticos</h2>
          <p className="text-muted-foreground">Configure avaliações periódicas automáticas</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => executarCiclo.mutate()} disabled={executarCiclo.isPending}>
            <Play className="w-4 h-4 mr-2" />
            Executar Agora
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Ciclo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Ciclo de Avaliação</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Nome do Ciclo</Label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Avaliação Trimestral 2024"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Tipo</Label>
                    <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="trimestral">Trimestral</SelectItem>
                        <SelectItem value="semestral">Semestral</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Data de Início</Label>
                    <Input
                      type="date"
                      value={formData.data_inicio}
                      onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Filtrar por Empresa (opcional)</Label>
                  <Select value={formData.empresa_id} onValueChange={(v) => setFormData({ ...formData, empresa_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as empresas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {empresas?.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Filtrar por Setor (opcional)</Label>
                    <Select value={formData.setor_id} onValueChange={(v) => setFormData({ ...formData, setor_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os setores" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {setores?.map((setor) => (
                          <SelectItem key={setor.id} value={setor.id}>
                            {setor.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Filtrar por Função (opcional)</Label>
                    <Select value={formData.funcao_id} onValueChange={(v) => setFormData({ ...formData, funcao_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas as funções" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {funcoes?.map((funcao) => (
                          <SelectItem key={funcao.id} value={funcao.id}>
                            {funcao.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Dias para Conclusão</Label>
                  <Input
                    type="number"
                    value={formData.dias_para_conclusao}
                    onChange={(e) => setFormData({ ...formData, dias_para_conclusao: parseInt(e.target.value) })}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.criar_metas}
                    onCheckedChange={(checked) => setFormData({ ...formData, criar_metas: checked })}
                  />
                  <Label>Criar metas junto com avaliação</Label>
                </div>

                <Button onClick={() => createCiclo.mutate(formData)} disabled={createCiclo.isPending}>
                  Criar Ciclo
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4">
        {ciclos?.map((ciclo) => (
          <Card key={ciclo.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {ciclo.nome}
                    <Badge variant={ciclo.ativo ? "default" : "secondary"}>
                      {ciclo.ativo ? "Ativo" : "Pausado"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {ciclo.tipo.charAt(0).toUpperCase() + ciclo.tipo.slice(1)} •{" "}
                    Próxima execução: {format(dataBR(ciclo.data_proxima_execucao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowHistory(ciclo.id)}>
                    <History className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleCiclo.mutate({ id: ciclo.id, ativo: ciclo.ativo })}
                  >
                    {ciclo.ativo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteCiclo.mutate(ciclo.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Empresa:</span>{" "}
                  {ciclo.empresas?.nome || "Todas"}
                </div>
                <div>
                  <span className="text-muted-foreground">Setor:</span>{" "}
                  {ciclo.setores?.nome || "Todos"}
                </div>
                <div>
                  <span className="text-muted-foreground">Função:</span>{" "}
                  {ciclo.funcoes?.nome || "Todas"}
                </div>
                <div>
                  <span className="text-muted-foreground">Prazo:</span>{" "}
                  {ciclo.dias_para_conclusao} dias
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!showHistory} onOpenChange={() => setShowHistory(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Execuções</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {execucoes?.map((exec) => (
              <Card key={exec.id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        {format(dataBR(exec.data_execucao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {exec.avaliacoes_criadas} avaliações criadas
                      </p>
                    </div>
                    <Badge variant={exec.status === "sucesso" ? "default" : "destructive"}>
                      {exec.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
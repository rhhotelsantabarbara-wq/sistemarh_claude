import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, FileText, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";

const meses = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function Contabilidade() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentDate = new Date();
  const [mes, setMes] = useState(currentDate.getMonth() + 1);
  const [ano, setAno] = useState(currentDate.getFullYear());
  const [empresaId, setEmpresaId] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");
  const [filterEmpresaId, setFilterEmpresaId] = useState<string>("all");

  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-contabilidade", empresaId],
    queryFn: async () => {
      let q = supabase.from("employees").select("id, nome_completo, empresa_id").in("status", ["ativo", "ferias"]).order("nome_completo");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: registros, isLoading } = useQuery({
    queryKey: ["contabilidade", mes, ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("informacoes_contabilidade")
        .select("*, empresas(nome), employees(nome_completo)")
        .eq("mes", mes)
        .eq("ano", ano)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredRegistros = useMemo(() => {
    if (!registros) return [];
    if (filterEmpresaId === "all") return registros;
    if (filterEmpresaId === "geral") return registros.filter((r: any) => !r.empresa_id);
    return registros.filter((r: any) => r.empresa_id === filterEmpresaId);
  }, [registros, filterEmpresaId]);

  const addMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("informacoes_contabilidade").insert({
        user_id: user.id,
        empresa_id: empresaId || null,
        employee_id: employeeId || null,
        mes,
        ano,
        observacoes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Informação cadastrada com sucesso!");
      setObservacoes("");
      setEmployeeId("");
      queryClient.invalidateQueries({ queryKey: ["contabilidade"] });
    },
    onError: () => toast.error("Erro ao cadastrar informação"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("informacoes_contabilidade").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro removido!");
      queryClient.invalidateQueries({ queryKey: ["contabilidade"] });
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const exportPDF = () => {
    if (!filteredRegistros.length) return toast.error("Nenhum registro para exportar");
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Informações para Contabilidade", 14, 20);
    doc.setFontSize(11);
    doc.text(`Período: ${meses[mes - 1]} / ${ano}`, 14, 30);
    if (filterEmpresaId !== "all") {
      const nomeEmpresa = filterEmpresaId === "geral"
        ? "Geral (sem empresa)"
        : empresas?.find((e) => e.id === filterEmpresaId)?.nome || "";
      doc.text(`Empresa: ${nomeEmpresa}`, 14, 37);
    }
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, filterEmpresaId !== "all" ? 44 : 37);

    let yPos = filterEmpresaId !== "all" ? 56 : 49;
    doc.setFontSize(10);

    filteredRegistros.forEach((r: any, i: number) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      const empresa = r.empresas?.nome || "Geral";
      const func = r.employees?.nome_completo || "—";
      doc.setFont("helvetica", "bold");
      doc.text(`${i + 1}. Empresa: ${empresa} | Funcionário: ${func}`, 14, yPos);
      yPos += 6;
      doc.setFont("helvetica", "normal");

      const lines = doc.splitTextToSize(r.observacoes, 180);
      lines.forEach((line: string) => {
        if (yPos > 280) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, 18, yPos);
        yPos += 5;
      });
      yPos += 4;
    });

    doc.save(`contabilidade-${meses[mes - 1].toLowerCase()}-${ano}.pdf`);
    toast.success("PDF exportado!");
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>

        <h1 className="text-2xl font-bold">Informações para Contabilidade</h1>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nova Informação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select value={mes.toString()} onValueChange={(v) => setMes(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {meses.map((m, i) => (
                      <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Select value={ano.toString()} onValueChange={(v) => setAno(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Empresa (opcional)</Label>
                <Select value={empresaId} onValueChange={(v) => { setEmpresaId(v === "none" ? "" : v); setEmployeeId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Geral" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geral (sem empresa)</SelectItem>
                    {empresas?.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Funcionário (opcional)</Label>
                <Select value={employeeId} onValueChange={(v) => setEmployeeId(v === "none" ? "" : v)} disabled={!empresaId}>
                  <SelectTrigger><SelectValue placeholder={empresaId ? "Todos" : "Selecione empresa"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todos</SelectItem>
                    {employees?.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome_completo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações *</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Descreva as informações para o contador..."
                rows={4}
              />
            </div>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!observacoes.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Cadastrar
            </Button>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg">
                Registros — {meses[mes - 1]} / {ano}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={filterEmpresaId} onValueChange={setFilterEmpresaId}>
                  <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as empresas</SelectItem>
                    <SelectItem value="geral">Geral (sem empresa)</SelectItem>
                    {empresas?.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={exportPDF} disabled={!filteredRegistros.length}>
                  <FileText className="w-4 h-4 mr-2" /> Exportar PDF
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{filteredRegistros.length} registro(s)</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : filteredRegistros.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Funcionário</TableHead>
                      <TableHead className="max-w-[400px]">Observações</TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegistros.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.empresas?.nome || "Geral"}</TableCell>
                        <TableCell>{r.employees?.nome_completo || "—"}</TableCell>
                        <TableCell className="max-w-[400px] whitespace-pre-wrap">{r.observacoes}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(r.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

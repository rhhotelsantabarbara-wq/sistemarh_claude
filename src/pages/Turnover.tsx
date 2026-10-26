import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { parseISO, isWithinInterval } from "date-fns";

export default function Turnover() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSetor, setSelectedSetor] = useState<string>("todos");

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("created_at");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: setores } = useQuery({
    queryKey: ["setores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setores")
        .select("*")
        .order("nome");
      
      if (error) throw error;
      return data;
    },
  });

  const calculateTurnover = (setor?: string) => {
    if (!employees || !startDate || !endDate) return null;

    const start = parseISO(startDate);
    const end = parseISO(endDate);

    // Filtrar por setor se especificado
    const filteredEmployees = setor && setor !== "todos" 
      ? employees.filter(emp => emp.setor === setor)
      : employees;

    // Funcionários ativos no início do período
    const activeAtStart = filteredEmployees.filter(emp => {
      if (!emp.data_admissao) return false;
      const admissionDate = parseISO(emp.data_admissao);
      return admissionDate <= start;
    }).length;

    // Funcionários demitidos durante o período
    const dismissed = filteredEmployees.filter(emp => {
      if (emp.status !== 'demitido' || !emp.updated_at) return false;
      const updateDate = parseISO(emp.updated_at);
      return isWithinInterval(updateDate, { start, end });
    }).length;

    // Novos funcionários contratados durante o período
    const hired = filteredEmployees.filter(emp => {
      if (!emp.data_admissao) return false;
      const admissionDate = parseISO(emp.data_admissao);
      return isWithinInterval(admissionDate, { start, end });
    }).length;

    // Funcionários ativos no final do período
    const activeAtEnd = filteredEmployees.filter(emp => {
      if (!emp.data_admissao) return false;
      const admissionDate = parseISO(emp.data_admissao);
      return admissionDate <= end && emp.status !== 'demitido';
    }).length;

    const averageEmployees = (activeAtStart + activeAtEnd) / 2;
    const turnoverRate = averageEmployees > 0 ? (dismissed / averageEmployees) * 100 : 0;

    return {
      activeAtStart,
      activeAtEnd,
      dismissed,
      hired,
      averageEmployees,
      turnoverRate,
    };
  };

  const stats = calculateTurnover(selectedSetor);

  // Calcular turnover por setor
  const turnoverPorSetor = setores?.map(setor => {
    const setorStats = calculateTurnover(setor.nome);
    return {
      nome: setor.nome,
      ...setorStats,
    };
  }).filter(s => s.averageEmployees && s.averageEmployees > 0);

  return (
    <div className="container mx-auto p-0 sm:p-2 lg:p-4 max-w-6xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/dashboard")}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar
      </Button>
      <h1 className="text-3xl font-bold mb-6">Relatório de Turnover</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Selecionar Período e Filtros</CardTitle>
          <CardDescription>
            Escolha o período e setor para análise do turnover
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Setor</Label>
              <Select value={selectedSetor} onValueChange={setSelectedSetor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Setores</SelectItem>
                  {setores?.map((setor) => (
                    <SelectItem key={setor.id} value={setor.nome}>
                      {setor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {stats && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Funcionários Ativos (Início)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.activeAtStart}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Funcionários Ativos (Fim)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.activeAtEnd}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Demissões</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-destructive">{stats.dismissed}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contratações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">{stats.hired}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Média de Funcionários</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.averageEmployees.toFixed(1)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Taxa de Turnover</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.turnoverRate.toFixed(2)}%</p>
              </CardContent>
            </Card>
          </div>

          {selectedSetor === "todos" && turnoverPorSetor && turnoverPorSetor.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Turnover por Setor</CardTitle>
                <CardDescription>Comparativo de taxa de turnover entre setores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Setor</th>
                        <th className="text-center p-2">Ativos (Início)</th>
                        <th className="text-center p-2">Ativos (Fim)</th>
                        <th className="text-center p-2">Demissões</th>
                        <th className="text-center p-2">Contratações</th>
                        <th className="text-center p-2">Média</th>
                        <th className="text-center p-2">Taxa Turnover</th>
                      </tr>
                    </thead>
                    <tbody>
                      {turnoverPorSetor.map((setor) => (
                        <tr key={setor.nome} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-medium">{setor.nome}</td>
                          <td className="text-center p-2">{setor.activeAtStart}</td>
                          <td className="text-center p-2">{setor.activeAtEnd}</td>
                          <td className="text-center p-2 text-destructive">{setor.dismissed}</td>
                          <td className="text-center p-2 text-green-600">{setor.hired}</td>
                          <td className="text-center p-2">{setor.averageEmployees?.toFixed(1)}</td>
                          <td className="text-center p-2 font-bold">{setor.turnoverRate?.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

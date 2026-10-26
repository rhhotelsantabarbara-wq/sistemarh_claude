import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";
import { dataBR } from "@/lib/date";

const TIPO_DIA_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "abonado", label: "Abonado" },
  { value: "falta", label: "Falta" },
  { value: "ferias", label: "Férias" },
  { value: "atestado", label: "Atestado" },
  { value: "dsr", label: "DSR" },
  { value: "compensacao", label: "Compensação" },
];

interface DayRecord {
  data: string;
  horaEntrada: string;
  horaSaida: string;
  horaInicioIntervalo: string;
  horaFimIntervalo: string;
  tipoDia: string;
  horasTrabalhadas: number;
}

export function LancamentoPontoLote() {
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [filterEmpresa, setFilterEmpresa] = useState("all");
  const [filterSetor, setFilterSetor] = useState("all");
  const queryClient = useQueryClient();

  const { data: empresas } = useQuery({
    queryKey: ["empresas-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome")
        .order("nome");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: setores } = useQuery({
    queryKey: ["setores-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setores")
        .select("id, nome")
        .order("nome");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: employees, isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees-for-ponto-lote", filterEmpresa, filterSetor],
    queryFn: async () => {
      let query = supabase
        .from("employees")
        .select("id, nome_completo, cargo, empresa_id, setor")
        .in("status", ["ativo", "ferias"]);
      
      if (filterEmpresa && filterEmpresa !== "all") {
        query = query.eq("empresa_id", filterEmpresa);
      }
      
      if (filterSetor && filterSetor !== "all") {
        query = query.eq("setor", filterSetor);
      }
      
      const { data, error } = await query.order("nome_completo");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: existingRecords } = useQuery({
    queryKey: ["registros-ponto-mes", selectedEmployee, selectedMonth],
    queryFn: async () => {
      if (!selectedEmployee || !selectedMonth) return [];
      
      const [year, month] = selectedMonth.split("-");
      const startDate = format(startOfMonth(new Date(parseInt(year), parseInt(month) - 1)), "yyyy-MM-dd");
      const endDate = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("registros_ponto")
        .select("*")
        .eq("employee_id", selectedEmployee)
        .gte("data", startDate)
        .lte("data", endDate);
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEmployee && !!selectedMonth,
  });

  const generateDays = () => {
    if (!selectedMonth) return;
    
    const [year, month] = selectedMonth.split("-");
    const start = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
    const end = endOfMonth(new Date(parseInt(year), parseInt(month) - 1));
    const days = eachDayOfInterval({ start, end });
    
    const newRecords: DayRecord[] = days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const existing = existingRecords?.find(r => r.data === dateStr);
      
      if (existing) {
        return {
          data: dateStr,
          horaEntrada: existing.hora_entrada || "",
          horaSaida: existing.hora_saida || "",
          horaInicioIntervalo: existing.hora_inicio_intervalo || "",
          horaFimIntervalo: existing.hora_fim_intervalo || "",
          tipoDia: existing.tipo_dia,
          horasTrabalhadas: existing.horas_trabalhadas || 0,
        };
      }
      
      return {
        data: dateStr,
        horaEntrada: "",
        horaSaida: "",
        horaInicioIntervalo: "",
        horaFimIntervalo: "",
        tipoDia: isWeekend(day) ? "dsr" : "normal",
        horasTrabalhadas: 0,
      };
    });
    
    setRecords(newRecords);
  };

  const calculateHours = (record: DayRecord) => {
    if (record.tipoDia === "compensacao") return record.horasTrabalhadas; // handled separately
    if (record.tipoDia !== "normal" || !record.horaEntrada || !record.horaSaida) return 0;
    
    const [entradaH, entradaM] = record.horaEntrada.split(":").map(Number);
    const [saidaH, saidaM] = record.horaSaida.split(":").map(Number);
    
    let totalMinutos = (saidaH * 60 + saidaM) - (entradaH * 60 + entradaM);
    
    if (record.horaInicioIntervalo && record.horaFimIntervalo) {
      const [inicioH, inicioM] = record.horaInicioIntervalo.split(":").map(Number);
      const [fimH, fimM] = record.horaFimIntervalo.split(":").map(Number);
      const intervaloMinutos = (fimH * 60 + fimM) - (inicioH * 60 + inicioM);
      totalMinutos -= intervaloMinutos;
    }
    
    return parseFloat((totalMinutos / 60).toFixed(2));
  };

  const updateRecord = async (index: number, field: keyof DayRecord, value: any) => {
    const updated = [...records];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === "tipoDia" && value === "compensacao") {
      // Buscar horas previstas do funcionário
      const { data: config } = await supabase
        .from("configuracao_horas_trabalho")
        .select("horas_diarias_esperadas")
        .eq("employee_id", selectedEmployee)
        .maybeSingle();
      const horasPrevistas = config?.horas_diarias_esperadas ?? 8;
      updated[index].horasTrabalhadas = -horasPrevistas;
    } else if (field !== "horasTrabalhadas") {
      updated[index].horasTrabalhadas = calculateHours(updated[index]);
    }
    
    setRecords(updated);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const recordsToSave = records.map(record => ({
        employee_id: selectedEmployee,
        data: record.data,
        hora_entrada: record.tipoDia === "normal" ? record.horaEntrada || null : null,
        hora_saida: record.tipoDia === "normal" ? record.horaSaida || null : null,
        hora_inicio_intervalo: record.tipoDia === "normal" ? record.horaInicioIntervalo || null : null,
        hora_fim_intervalo: record.tipoDia === "normal" ? record.horaFimIntervalo || null : null,
        horas_trabalhadas: record.horasTrabalhadas,
        tipo_dia: record.tipoDia,
        created_by: user?.id,
      }));
      
      const { error } = await supabase
        .from("registros_ponto")
        .upsert(recordsToSave, {
          onConflict: "employee_id,data"
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registros salvos com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["registros-ponto"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar registros: " + error.message);
    },
  });

  const totalHoras = records.reduce((sum, r) => sum + r.horasTrabalhadas, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-4">Lançamento em Lote</h2>
        <p className="text-muted-foreground">
          Registre o ponto de um funcionário para um mês inteiro
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="filter-empresa-lote">Filtrar por Empresa</Label>
          <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as empresas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {empresas?.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-setor-lote">Filtrar por Setor</Label>
          <Select value={filterSetor} onValueChange={setFilterSetor}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os setores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {setores?.map((setor) => (
                <SelectItem key={setor.id} value={setor.nome}>
                  {setor.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="employee-lote">Funcionário *</Label>
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o funcionário" />
            </SelectTrigger>
            <SelectContent>
              {loadingEmployees ? (
                <SelectItem value="loading" disabled>Carregando...</SelectItem>
              ) : (
                employees?.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome_completo} - {emp.cargo}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="month">Mês *</Label>
          <Input
            id="month"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={generateDays}
          disabled={!selectedEmployee || !selectedMonth}
          variant="outline"
        >
          Gerar Dias do Mês
        </Button>
      </div>

      {records.length > 0 && (
        <>
          <div className="border rounded-lg overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Início Intervalo</TableHead>
                  <TableHead>Fim Intervalo</TableHead>
                  <TableHead>Horas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record, index) => (
                  <TableRow key={record.data}>
                    <TableCell className="font-medium">
                      {format(dataBR(record.data + "T00:00:00"), "dd/MM (EEE)", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={record.tipoDia}
                        onValueChange={(value) => updateRecord(index, "tipoDia", value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPO_DIA_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={record.horaEntrada}
                        onChange={(e) => updateRecord(index, "horaEntrada", e.target.value)}
                        disabled={record.tipoDia !== "normal"}
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={record.horaSaida}
                        onChange={(e) => updateRecord(index, "horaSaida", e.target.value)}
                        disabled={record.tipoDia !== "normal"}
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={record.horaInicioIntervalo}
                        onChange={(e) => updateRecord(index, "horaInicioIntervalo", e.target.value)}
                        disabled={record.tipoDia !== "normal"}
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={record.horaFimIntervalo}
                        onChange={(e) => updateRecord(index, "horaFimIntervalo", e.target.value)}
                        disabled={record.tipoDia !== "normal"}
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell className="font-semibold">
                      {record.horasTrabalhadas.toFixed(2)}h
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="text-lg font-semibold">
              Total de Horas no Mês: {totalHoras.toFixed(2)}h
            </div>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              size="lg"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Todos os Registros
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

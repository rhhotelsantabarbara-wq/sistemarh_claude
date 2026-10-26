import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buscarTudo } from "@/lib/buscarTudo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle, Clock, Coffee, LogOut, Wallet, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { dataBR } from "@/lib/date";

const TIPO_DIA_LABELS: Record<string, string> = {
  normal: "Normal",
  abonado: "Abonado",
  falta: "Falta",
  ferias: "Férias",
  atestado: "Atestado",
};

function formatHoras(decimal: number | null | undefined): string {
  if (!decimal) return "0h00min";
  const isNeg = decimal < 0;
  const abs = Math.abs(decimal);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `${isNeg ? "-" : ""}${h}h${String(m).padStart(2, "0")}min`;
}

type Registro = {
  id: string;
  employee_id: string;
  data: string;
  hora_entrada: string | null;
  hora_saida: string | null;
  hora_inicio_intervalo: string | null;
  hora_fim_intervalo: string | null;
  tipo_dia: string | null;
  horas_trabalhadas: number | null;
};
type Config = any;

type AlertType = "intervaloCurto" | "intervaloLongo" | "atrasos" | "saidasAnt" | "banco" | "saldoMes";

function timeToMin(t: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function AlertasPonto() {
  const [mes, setMes] = useState<string>(currentMonthStr());
  const [selected, setSelected] = useState<{ id: string; nome: string; tipo: AlertType } | null>(null);
  const { start, end } = monthRange(mes);

  const { data: detalhe, isLoading: ld } = useQuery({
    queryKey: ["alertas-ponto-detalhe", selected?.id, start, end],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registros_ponto")
        .select("*")
        .eq("employee_id", selected!.id)
        .gte("data", start)
        .lte("data", end)
        .order("data");
      if (error) throw error;
      return data as Registro[];
    },
  });

  const { data: config, isLoading: lc } = useQuery({
    queryKey: ["alertas-ponto-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracao_alertas_ponto")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Config;
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["alertas-ponto-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome_completo, cargo, setor")
        .in("status", ["ativo", "ferias"]);
      if (error) throw error;
      return data;
    },
  });

  // Horário padrão vem da configuração de alertas

  const { data: registros, isLoading: lr } = useQuery({
    queryKey: ["alertas-ponto-registros", start, end],
    enabled: !!config,
    queryFn: async () => {
      // Todos os funcionários no período passam fácil de 1.000 linhas: busca em páginas
      const data = await buscarTudo((de, ate) =>
        supabase
          .from("registros_ponto")
          .select("employee_id, data, hora_entrada, hora_saida, hora_inicio_intervalo, hora_fim_intervalo, tipo_dia, horas_trabalhadas")
          .gte("data", start)
          .lte("data", end)
          .order("data")
          .range(de, ate),
      );
      return data as Registro[];
    },
  });

  const { data: configHoras } = useQuery({
    queryKey: ["alertas-ponto-config-horas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracao_horas_trabalho")
        .select("employee_id, horas_diarias_esperadas");
      if (error) throw error;
      return data as { employee_id: string; horas_diarias_esperadas: number | null }[];
    },
  });

  const { data: bancoHoras } = useQuery({
    queryKey: ["alertas-ponto-banco"],
    queryFn: async () => {
      const { data, error } = await supabase.from("banco_horas").select("employee_id, saldo_horas");
      if (error) throw error;
      return data;
    },
  });
  const horasMap = useMemo(() => new Map<string, any>(), []);

  const alertas = useMemo(() => {
    if (!config || !employees || !registros) return null;

    const empMap = new Map(employees.map((e: any) => [e.id, e]));

    type Item = { employee_id: string; nome: string; cargo: string; setor: string; ocorrencias: number; detalhe?: string };
    const intervaloCurto: Map<string, number> = new Map();
    const intervaloLongo: Map<string, number> = new Map();
    const atrasos: Map<string, number> = new Map();
    const saidasAnt: Map<string, number> = new Map();

    for (const r of registros) {
      const ini = timeToMin(r.hora_inicio_intervalo);
      const fim = timeToMin(r.hora_fim_intervalo);
      if (ini !== null && fim !== null && fim > ini) {
        const dur = fim - ini;
        if (dur < config.intervalo_min_minutos)
          intervaloCurto.set(r.employee_id, (intervaloCurto.get(r.employee_id) || 0) + 1);
        if (dur > config.intervalo_max_minutos)
          intervaloLongo.set(r.employee_id, (intervaloLongo.get(r.employee_id) || 0) + 1);
      }

      const entradaPrev = timeToMin(config.hora_entrada_padrao ?? "08:00:00");
      const saidaPrev = timeToMin(config.hora_saida_padrao ?? "17:00:00");

      const entrada = timeToMin(r.hora_entrada);
      const saida = timeToMin(r.hora_saida);

      if (entrada !== null && entradaPrev !== null && entrada > entradaPrev + config.tolerancia_atraso_minutos)
        atrasos.set(r.employee_id, (atrasos.get(r.employee_id) || 0) + 1);

      if (saida !== null && saidaPrev !== null && saida < saidaPrev - config.tolerancia_saida_minutos)
        saidasAnt.set(r.employee_id, (saidasAnt.get(r.employee_id) || 0) + 1);
    }

    const buildList = (m: Map<string, number>): Item[] => {
      const items: Item[] = [];
      m.forEach((n, id) => {
        if (n >= config.ocorrencias_minimas) {
          const e: any = empMap.get(id);
          if (e)
            items.push({
              employee_id: id,
              nome: (e.nome_completo || "").toUpperCase(),
              cargo: e.cargo,
              setor: e.setor,
              ocorrencias: n,
            });
        }
      });
      return items.sort((a, b) => b.ocorrencias - a.ocorrencias);
    };

    const bancoItems: Item[] = [];
    if (config.alerta_banco_horas_ativo && bancoHoras) {
      for (const b of bancoHoras as any[]) {
        const saldo = Number(b.saldo_horas);
        if (saldo < config.banco_horas_min || saldo > config.banco_horas_max) {
          const e: any = empMap.get(b.employee_id);
          if (e)
            bancoItems.push({
              employee_id: b.employee_id,
              nome: (e.nome_completo || "").toUpperCase(),
              cargo: e.cargo,
              setor: e.setor,
              ocorrencias: 1,
              detalhe: `Saldo: ${saldo.toFixed(2)}h`,
            });
        }
      }
      bancoItems.sort((a, b) => a.nome.localeCompare(b.nome));
    }

    // Saldo de horas negativo no mês vigente (não banco)
    const saldoItems: Item[] = [];
    const horasMapCfg = new Map<string, number>(
      (configHoras || []).map((c) => [c.employee_id, Number(c.horas_diarias_esperadas) || 8])
    );
    const porEmp = new Map<string, { trabalhadas: number; diasNormal: number }>();
    for (const r of registros) {
      const agg = porEmp.get(r.employee_id) || { trabalhadas: 0, diasNormal: 0 };
      agg.trabalhadas += Number(r.horas_trabalhadas || 0);
      const lancado = !!(r.hora_entrada || r.hora_saida || r.hora_inicio_intervalo || r.hora_fim_intervalo || (r.horas_trabalhadas && r.horas_trabalhadas > 0));
      if (r.tipo_dia === "normal" && lancado) agg.diasNormal += 1;
      porEmp.set(r.employee_id, agg);
    }
    porEmp.forEach((agg, id) => {
      const e: any = empMap.get(id);
      if (!e) return;
      const hDia = horasMapCfg.get(id) ?? 8;
      const esperadas = agg.diasNormal * hDia;
      const saldo = agg.trabalhadas - esperadas;
      if (saldo < 0) {
        const h = Math.floor(Math.abs(saldo));
        const m = Math.round((Math.abs(saldo) - h) * 60);
        saldoItems.push({
          employee_id: id,
          nome: (e.nome_completo || "").toUpperCase(),
          cargo: e.cargo,
          setor: e.setor,
          ocorrencias: 1,
          detalhe: `Saldo do mês: -${h}h${String(m).padStart(2, "0")}min`,
        });
      }
    });
    saldoItems.sort((a, b) => a.nome.localeCompare(b.nome));

    return {
      intervaloCurto: config.alerta_intervalo_curto_ativo ? buildList(intervaloCurto) : [],
      intervaloLongo: config.alerta_intervalo_longo_ativo ? buildList(intervaloLongo) : [],
      atrasos: config.alerta_atraso_ativo ? buildList(atrasos) : [],
      saidasAnt: config.alerta_saida_antecipada_ativo ? buildList(saidasAnt) : [],
      banco: bancoItems,
      saldoMes: saldoItems,
    };
  }, [config, employees, registros, bancoHoras, configHoras, horasMap]);

  function isOcorrenciaRow(r: Registro, tipo: AlertType): boolean {
    if (!config) return false;
    const entradaPrev = timeToMin(config.hora_entrada_padrao ?? "08:00:00");
    const saidaPrev = timeToMin(config.hora_saida_padrao ?? "17:00:00");


    switch (tipo) {
      case "intervaloCurto": {
        const ini = timeToMin(r.hora_inicio_intervalo);
        const fim = timeToMin(r.hora_fim_intervalo);
        if (ini !== null && fim !== null && fim > ini) {
          return fim - ini < config.intervalo_min_minutos;
        }
        return false;
      }
      case "intervaloLongo": {
        const ini = timeToMin(r.hora_inicio_intervalo);
        const fim = timeToMin(r.hora_fim_intervalo);
        if (ini !== null && fim !== null && fim > ini) {
          return fim - ini > config.intervalo_max_minutos;
        }
        return false;
      }
      case "atrasos": {
        const entrada = timeToMin(r.hora_entrada);
        return entrada !== null && entradaPrev !== null && entrada > entradaPrev + config.tolerancia_atraso_minutos;
      }
      case "saidasAnt": {
        const saida = timeToMin(r.hora_saida);
        return saida !== null && saidaPrev !== null && saida < saidaPrev - config.tolerancia_saida_minutos;
      }
      case "banco":
      default:
        return false;
    }
  }

  if (lc || lr || !alertas) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const total =
    alertas.intervaloCurto.length +
    alertas.intervaloLongo.length +
    alertas.atrasos.length +
    alertas.saidasAnt.length +
    alertas.banco.length +
    alertas.saldoMes.length;

  const mesLabel = dataBR(`${mes}-01T00:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const Section = ({
    title,
    icon: Icon,
    items,
    description,
    variant = "default",
    tipo,
  }: {
    title: string;
    icon: any;
    items: any[];
    description: string;
    variant?: "default" | "destructive";
    tipo: AlertType;
  }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-primary" />
            {title}
          </span>
          <Badge variant={items.length > 0 ? "destructive" : "secondary"}>{items.length}</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma ocorrência.</p>
        ) : (
          items.map((it) => (
            <button
              key={it.employee_id}
              type="button"
              onClick={() => setSelected({ id: it.employee_id, nome: it.nome, tipo })}
              className="w-full text-left transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring rounded-lg"
            >
              <Alert variant={variant} className="cursor-pointer">
                <AlertTitle className="font-bold">{it.nome}</AlertTitle>
                <AlertDescription className="text-xs">
                  {it.cargo} · {it.setor} —{" "}
                  {it.detalhe || `${it.ocorrencias} ocorrência(s) em ${mesLabel}`}
                </AlertDescription>
              </Alert>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="space-y-2 flex-1 max-w-xs">
            <Label>Mês de análise</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value || currentMonthStr())} />
          </div>
          <p className="text-sm text-muted-foreground">
            Exibindo alertas referentes a <strong className="capitalize">{mesLabel}</strong>.
          </p>
        </CardContent>
      </Card>

      <Alert>
        <AlertTriangle className="w-4 h-4" />
        <AlertTitle>{total === 0 ? "Tudo em ordem" : `${total} alerta(s) detectado(s)`}</AlertTitle>
        <AlertDescription>
          Recorrência ≥ {config.ocorrencias_minimas} ocorrências no mês selecionado.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section
          title="Intervalo curto recorrente"
          icon={Coffee}
          items={alertas.intervaloCurto}
          description={`Intervalo abaixo de ${config.intervalo_min_minutos} min`}
          variant="destructive"
          tipo="intervaloCurto"
        />
        <Section
          title="Intervalo longo recorrente"
          icon={Coffee}
          items={alertas.intervaloLongo}
          description={`Intervalo acima de ${config.intervalo_max_minutos} min`}
          tipo="intervaloLongo"
        />
        <Section
          title="Atraso recorrente"
          icon={Clock}
          items={alertas.atrasos}
          description={`Entrada após o previsto + ${config.tolerancia_atraso_minutos} min`}
          variant="destructive"
          tipo="atrasos"
        />
        <Section
          title="Saída antecipada recorrente"
          icon={LogOut}
          items={alertas.saidasAnt}
          description={`Saída antes do previsto − ${config.tolerancia_saida_minutos} min`}
          tipo="saidasAnt"
        />
        <Section
          title="Banco de horas fora da faixa"
          icon={Wallet}
          items={alertas.banco}
          description={`Faixa aceitável: ${config.banco_horas_min}h a ${config.banco_horas_max}h`}
          variant="destructive"
          tipo="banco"
        />
        <Section
          title="Saldo negativo no mês"
          icon={TrendingDown}
          items={alertas.saldoMes}
          description="Horas trabalhadas abaixo do esperado no mês selecionado"
          variant="destructive"
          tipo="saldoMes"
        />
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relatório de Ponto — {selected?.nome}</DialogTitle>
            <DialogDescription className="capitalize">{mesLabel}</DialogDescription>
          </DialogHeader>
          {ld ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : !detalhe || detalhe.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum registro de ponto no mês selecionado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Início Int.</TableHead>
                  <TableHead>Fim Int.</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalhe.map((r) => {
                  const ocorrencia = selected && isOcorrenciaRow(r, selected.tipo);
                  return (
                    <TableRow
                      key={r.id}
                      className={
                        ocorrencia
                          ? "bg-destructive/10 border-l-4 border-l-destructive"
                          : ""
                      }
                    >
                      <TableCell className="whitespace-nowrap">
                        {format(dataBR(r.data + "T00:00:00"), "dd/MM (EEE)", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{TIPO_DIA_LABELS[r.tipo_dia || ""] || r.tipo_dia || "-"}</TableCell>
                      <TableCell>{r.hora_entrada || "-"}</TableCell>
                      <TableCell>{r.hora_inicio_intervalo || "-"}</TableCell>
                      <TableCell>{r.hora_fim_intervalo || "-"}</TableCell>
                      <TableCell>{r.hora_saida || "-"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatHoras(r.horas_trabalhadas)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type CampoFicha, type GrupoFicha } from "@/lib/fichaCampos";

interface Props {
  grupos: GrupoFicha[];
  valores: Record<string, string>;
  onChange: (campo: string, valor: string) => void;
  /** esconde campos com valores em dinheiro */
  semFinanceiro?: boolean;
  /** só os campos que o próprio candidato preenche */
  somenteCandidato?: boolean;
  /** id do próprio funcionário (para não aparecer como gestor de si mesmo) */
  proprioId?: string;
}

const VAZIO = "__vazio__";

const useFuncionariosAtivos = (habilitado: boolean) =>
  useQuery({
    queryKey: ["funcionarios-ativos-nomes"],
    enabled: habilitado,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, nome_completo, cargo").neq("status", "demitido").order("nome_completo");
      if (error) throw error;
      return data || [];
    },
  });

export const CamposFicha = ({ grupos, valores, onChange, semFinanceiro, somenteCandidato, proprioId }: Props) => {
  const precisaFuncionarios = grupos.some((g) => g.campos.some((c) => c.tipo === "funcionario"));
  const { data: funcionarios } = useFuncionariosAtivos(precisaFuncionarios && !somenteCandidato);

  const visivel = (c: CampoFicha) =>
    (!somenteCandidato || c.candidato) && (!semFinanceiro || c.tipo !== "dinheiro") && (!c.mostrarSe || c.mostrarSe(valores));

  const campo = (c: CampoFicha) => {
    const id = `ficha-${c.campo}`;
    const v = valores[c.campo] ?? "";
    if (c.tipo === "sim_nao") {
      return (
        <div key={c.campo} className="flex min-h-10 items-center justify-between gap-3 rounded-md border px-3 py-2">
          <Label htmlFor={id} className="cursor-pointer font-normal">{c.rotulo}</Label>
          <Switch id={id} checked={v === "true"} onCheckedChange={(x) => onChange(c.campo, x ? "true" : "false")} />
        </div>
      );
    }
    let controle: React.ReactNode;
    if (c.tipo === "select" || c.tipo === "funcionario") {
      const opcoes = c.tipo === "funcionario"
        ? (funcionarios || []).filter((f: any) => f.id !== proprioId).map((f: any) => ({ valor: f.id, rotulo: f.nome_completo }))
        : (c.opcoes || []).map((o) => ({ valor: o, rotulo: o }));
      // mantém valores antigos que não estão mais na lista
      if (v && c.tipo === "select" && !c.opcoes?.includes(v)) opcoes.unshift({ valor: v, rotulo: v });
      controle = (
        <Select value={v || VAZIO} onValueChange={(x) => onChange(c.campo, x === VAZIO ? "" : x)}>
          <SelectTrigger id={id}><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={VAZIO}><span className="text-muted-foreground">Não informado</span></SelectItem>
            {opcoes.map((o) => <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    } else {
      const tipoInput = c.tipo === "data" ? "date" : c.tipo === "numero" || c.tipo === "dinheiro" ? "number" : c.tipo === "email" ? "email" : c.tipo === "telefone" ? "tel" : "text";
      controle = (
        <Input
          id={id}
          type={tipoInput}
          inputMode={c.tipo === "dinheiro" ? "decimal" : undefined}
          step={c.tipo === "dinheiro" ? "0.01" : undefined}
          min={c.tipo === "numero" || c.tipo === "dinheiro" ? 0 : undefined}
          value={v}
          placeholder={c.placeholder}
          onChange={(e) => onChange(c.campo, e.target.value)}
        />
      );
    }
    return (
      <div key={c.campo} className={c.largo ? "sm:col-span-2" : undefined}>
        <Label htmlFor={id} className="mb-1.5 block">{c.rotulo}</Label>
        {controle}
        {c.dica && <p className="mt-1 text-xs text-muted-foreground">{c.dica}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {grupos.map((g) => {
        const campos = g.campos.filter(visivel);
        if (campos.length === 0) return null;
        return (
          <section key={g.chave} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.titulo}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{campos.map(campo)}</div>
          </section>
        );
      })}
    </div>
  );
};

export default CamposFicha;

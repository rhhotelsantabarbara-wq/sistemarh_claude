import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatarValor, type GrupoFicha } from "@/lib/fichaCampos";

interface Props {
  grupos: GrupoFicha[];
  dados: any;
  semFinanceiro?: boolean;
}

/** Mostra os campos da ficha completa em modo leitura. Grupos totalmente vazios mostram só um aviso curto. */
const FichaLeitura = ({ grupos, dados, semFinanceiro }: Props) => {
  const gestorId = dados?.gestor_id;
  const { data: gestor } = useQuery({
    queryKey: ["nome-funcionario", gestorId],
    enabled: !!gestorId && grupos.some((g) => g.campos.some((c) => c.tipo === "funcionario")),
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("nome_completo").eq("id", gestorId).maybeSingle();
      return data?.nome_completo || "";
    },
  });
  const nomes = gestorId ? { [gestorId]: gestor || "…" } : {};
  const valores: Record<string, string> = {};
  for (const g of grupos) for (const c of g.campos) valores[c.campo] = dados?.[c.campo] == null ? "" : String(dados[c.campo]);

  return (
    <div className="space-y-6">
      {grupos.map((g) => {
        const campos = g.campos.filter((c) => (!semFinanceiro || c.tipo !== "dinheiro") && (!c.mostrarSe || c.mostrarSe(valores)));
        const preenchidos = campos.filter((c) => {
          const v = dados?.[c.campo];
          return v !== null && v !== undefined && v !== "" && v !== false;
        });
        return (
          <section key={g.chave}>
            <h3 className="mb-3 text-sm font-medium text-foreground">{g.titulo}</h3>
            {preenchidos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada informado. Use “Editar” para preencher.</p>
            ) : (
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                {campos.map((c) => (
                  <div key={c.campo} className={c.largo ? "sm:col-span-2" : undefined}>
                    <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{c.rotulo}</p>
                    <p className="mt-0.5 break-words text-sm">{formatarValor(c, dados?.[c.campo], nomes)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default FichaLeitura;

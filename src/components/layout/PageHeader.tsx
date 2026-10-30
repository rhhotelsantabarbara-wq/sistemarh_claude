import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  titulo: string;
  descricao?: string;
  icone?: LucideIcon;
  acoes?: ReactNode;
}

/** Cabeçalho padrão das páginas: título, descrição curta e botões à direita */
const PageHeader = ({ titulo, descricao, icone: Icone, acoes }: PageHeaderProps) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="min-w-0">
      <h1 className="flex items-center gap-2 text-xl font-medium leading-tight">
        {Icone && <Icone className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.8} />}
        {titulo}
      </h1>
      {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
    </div>
    {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
  </div>
);

/** Classe do botão principal no estilo do sistema (pílula, caixa alta pequena) */
export const BOTAO_PRINCIPAL = "h-10 px-5 text-[11px] font-bold uppercase tracking-[0.04em]";

/** Indicador numérico com faixa colorida à esquerda */
export const Indicador = ({ rotulo, valor, detalhe, faixa = "border-l-slate-300", cor = "" }: {
  rotulo: string; valor: ReactNode; detalhe?: ReactNode; faixa?: string; cor?: string;
}) => (
  <div className={`rounded-lg border-l-4 ${faixa} bg-card px-4 py-4 shadow-[0_1px_2px_rgba(20,24,40,0.06)] sm:px-5`}>
    <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{rotulo}</p>
    <p className={`mt-1 text-2xl font-medium tabular-nums sm:text-3xl ${cor}`}>{valor}</p>
    {detalhe && <p className="mt-0.5 text-xs text-muted-foreground">{detalhe}</p>}
  </div>
);

export default PageHeader;

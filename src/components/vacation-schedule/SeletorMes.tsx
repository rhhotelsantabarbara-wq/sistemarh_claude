import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface SeletorMesProps {
  valor: Date | null; // primeiro dia do mês escolhido (null = nenhum)
  onChange: (mes: Date) => void;
  placeholder?: string;
  id?: string;
}

// Escolha de mês e ano (de 2 anos atrás até 2 anos à frente)
export function SeletorMes({ valor, onChange, placeholder = "Mês", id = "seletor-mes" }: SeletorMesProps) {
  const anoAtual = new Date().getFullYear();
  const anos = [anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2];
  const ano = valor ? valor.getFullYear() : anoAtual;
  return (
    <div className="flex gap-2">
      <label htmlFor={`${id}-m`} className="sr-only">Mês</label>
      <Select value={valor ? String(valor.getMonth()) : undefined} onValueChange={(m) => onChange(new Date(ano, Number(m), 1))}>
        <SelectTrigger id={`${id}-m`} className="h-10 w-36 rounded-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {MESES.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
      <label htmlFor={`${id}-a`} className="sr-only">Ano</label>
      <Select value={String(ano)} onValueChange={(a) => onChange(new Date(Number(a), valor ? valor.getMonth() : new Date().getMonth(), 1))}>
        <SelectTrigger id={`${id}-a`} className="h-10 w-24 rounded-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, ChevronDown, ChevronUp, Stethoscope, UserPlus } from "lucide-react";
import { DIAS_AVISO_VENCIMENTO, nomeTipoDocumento, situacaoValidade } from "@/lib/documentosTipos";
import { toISODateLocal, todayISO } from "@/lib/date";
import { buscarTudo } from "@/lib/buscarTudo";

interface Item {
  chave: string;
  employeeId: string;
  pessoa: string;
  documento: string;
  validade: string;
}

const LIMITE_INICIAL = 6;

/** Documentos vencidos ou vencendo nos próximos 30 dias + admissões por link esperando conferência */
export const DocumentosVencendoAlert = () => {
  const navigate = useNavigate();
  const [tudo, setTudo] = useState(false);

  const { data } = useQuery({
    queryKey: ["documentos-vencendo"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const limite = new Date();
      limite.setDate(limite.getDate() + DIAS_AVISO_VENCIMENTO);
      const ate = toISODateLocal(limite);
      const [arquivos, cnh, convites, atestados] = await Promise.all([
        supabase.from("employee_files").select("id, employee_id, categoria, file_name, validade, employees!inner(nome_completo, status)").not("validade", "is", null).lte("validade", ate).neq("employees.status", "demitido"),
        supabase.from("employees").select("id, nome_completo, cnh_validade").not("cnh_validade", "is", null).lte("cnh_validade", ate).neq("status", "demitido"),
        (supabase as any).from("admissao_convites").select("id", { count: "exact", head: true }).eq("status", "preenchido"),
        (supabase as any).from("atestados_enviados").select("id", { count: "exact", head: true }).eq("status", "pendente"),
      ]);
      const itens: Item[] = [];
      // Um documento por pessoa e tipo: só o de validade mais recente conta (se já renovou, some do alerta)
      const maisRecente = new Map<string, any>();
      const todosComValidade = await buscarTudo<any>((de, ate) => supabase.from("employee_files").select("employee_id, categoria, validade").not("validade", "is", null).not("categoria", "is", null).range(de, ate));
      (todosComValidade || []).forEach((f: any) => {
        const k = `${f.employee_id}:${f.categoria}`;
        if (!maisRecente.has(k) || f.validade > maisRecente.get(k)) maisRecente.set(k, f.validade);
      });
      (arquivos.data || []).forEach((f: any) => {
        if (f.categoria && maisRecente.get(`${f.employee_id}:${f.categoria}`) > ate) return;
        itens.push({ chave: f.id, employeeId: f.employee_id, pessoa: f.employees?.nome_completo, documento: f.categoria ? nomeTipoDocumento(f.categoria) : f.file_name, validade: f.validade });
      });
      (cnh.data || []).forEach((e: any) => {
        if (itens.some((i) => i.employeeId === e.id && i.documento === "CNH")) return;
        itens.push({ chave: "cnh-" + e.id, employeeId: e.id, pessoa: e.nome_completo, documento: "CNH", validade: e.cnh_validade });
      });
      itens.sort((a, b) => a.validade.localeCompare(b.validade));
      return { itens, convitesPreenchidos: convites.count || 0, atestadosPendentes: atestados.count || 0 };
    },
  });

  if (!data || (data.itens.length === 0 && data.convitesPreenchidos === 0 && data.atestadosPendentes === 0)) return null;
  const hoje = todayISO();
  const vencidos = data.itens.filter((i) => i.validade < hoje).length;
  const visiveis = tudo ? data.itens : data.itens.slice(0, LIMITE_INICIAL);

  return (
    <Card className="border-amber-200 dark:border-amber-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <CalendarClock className="h-5 w-5 text-amber-600" />
          Pendências do RH
          {vencidos > 0 && <Badge variant="destructive">{vencidos} vencido{vencidos > 1 ? "s" : ""}</Badge>}
          {data.itens.length - vencidos > 0 && <Badge variant="secondary">{data.itens.length - vencidos} vencendo</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.atestadosPendentes > 0 && (
          <button type="button" onClick={() => navigate("/afastamentos")}
            className="flex w-full items-center gap-3 rounded-lg border border-rose-300/60 bg-rose-50 p-3 text-left transition hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40">
            <Stethoscope className="h-5 w-5 shrink-0 text-rose-600" />
            <span className="text-sm"><strong>{data.atestadosPendentes}</strong> {data.atestadosPendentes === 1 ? "atestado enviado pelo celular espera" : "atestados enviados pelo celular esperam"} aprovação</span>
          </button>
        )}
        {data.convitesPreenchidos > 0 && (
          <button type="button" onClick={() => navigate("/admissao-digital")}
            className="flex w-full items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-left transition hover:bg-primary/10">
            <UserPlus className="h-5 w-5 shrink-0 text-primary" />
            <span className="text-sm"><strong>{data.convitesPreenchidos}</strong> {data.convitesPreenchidos === 1 ? "admissão enviada pelo link espera" : "admissões enviadas pelo link esperam"} conferência do RH</span>
          </button>
        )}
        {visiveis.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {visiveis.map((i) => {
              const s = situacaoValidade(i.validade)!;
              return (
                <li key={i.chave}>
                  <button type="button" onClick={() => navigate(`/employee/${i.employeeId}`)} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{i.pessoa}</span>
                      <span className="block truncate text-xs text-muted-foreground">{i.documento}</span>
                    </span>
                    <span className={`shrink-0 text-xs font-medium ${s.tipo === "vencido" ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>{s.texto}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {data.itens.length > LIMITE_INICIAL && (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setTudo(!tudo)}>
            {tudo ? <><ChevronUp className="mr-1 h-4 w-4" />Mostrar menos</> : <><ChevronDown className="mr-1 h-4 w-4" />Ver todos ({data.itens.length})</>}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentosVencendoAlert;

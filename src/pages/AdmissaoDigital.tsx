import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, ClipboardCheck, Copy, ExternalLink, FileText, Loader2, MessageCircle, Plus, RotateCcw, Search, UserPlus, XCircle } from "lucide-react";
import EmployeeForm from "@/components/forms/EmployeeForm";
import { CAMPOS_ADMISSAO, GRUPOS_BASE, GRUPOS_FICHA, formatarValor } from "@/lib/fichaCampos";
import { nomeTipoDocumento, tipoDocumento } from "@/lib/documentosTipos";
import { todayISO, toISODateLocal, dataBR } from "@/lib/date";

const db = supabase as any;
const BUCKET = "admissao-documentos";

type Status = "aguardando" | "preenchido" | "aprovado" | "cancelado";

const linkDe = (codigo: string) => `${window.location.origin}/admissao/${codigo}`;
const mensagemWhats = (c: any) =>
  `Olá, ${String(c.nome || "").split(" ")[0]}! Seja bem-vindo(a)${c.empresas?.nome ? ` (${c.empresas.nome})` : ""}. ` +
  `Para fazer sua admissão, preencha seus dados e envie as fotos dos documentos por este link: ${linkDe(c.codigo)}`;
const abrirWhats = (c: any) => {
  const tel = String(c.telefone || "").replace(/\D/g, "");
  const numero = tel ? (tel.length <= 11 ? `55${tel}` : tel) : "";
  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagemWhats(c))}`, "_blank", "noopener");
};
const copiar = async (texto: string) => {
  try { await navigator.clipboard.writeText(texto); toast.success("Link copiado"); } catch { toast.error("Não foi possível copiar"); }
};
const dataHora = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

/** Depois de criar o funcionário: copia fotos dos documentos, foto de perfil e dependentes */
const concluirAdmissao = async (convite: any, employeeId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  const docs: any[] = convite.documentos || [];
  let fotoPerfil: string | null = null;
  const copiados: string[] = [];
  for (const d of docs) {
    try {
      const { data: blob, error } = await supabase.storage.from(BUCKET).download(d.path);
      if (error || !blob) throw error;
      const ext = (d.path.split(".").pop() || "jpg").toLowerCase();
      const destino = `${employeeId}/admissao-${d.tipo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const up = await supabase.storage.from("employee-files").upload(destino, blob, { contentType: blob.type || undefined });
      if (up.error) throw up.error;
      await supabase.from("employee_files").insert({
        employee_id: employeeId,
        file_name: `${nomeTipoDocumento(d.tipo)}.${ext}`,
        file_path: destino,
        file_type: blob.type || null,
        file_size: blob.size,
        description: "Enviado pelo candidato na admissão digital",
        uploaded_by: user?.id,
        categoria: tipoDocumento(d.tipo) ? d.tipo : "outro",
        validade: d.tipo === "cnh" && convite.dados?.cnh_validade ? convite.dados.cnh_validade : null,
      });
      if (d.tipo === "foto" && !fotoPerfil && blob.type.startsWith("image/")) {
        const nome = `${employeeId}-${Date.now()}.${ext}`;
        const f = await supabase.storage.from("employee-photos").upload(nome, blob, { upsert: true, contentType: blob.type });
        if (!f.error) fotoPerfil = supabase.storage.from("employee-photos").getPublicUrl(nome).data.publicUrl;
      }
      copiados.push(d.path);
    } catch (e) {
      console.error("Falha ao copiar documento da admissão", d, e);
    }
  }
  if (fotoPerfil) await supabase.from("employees").update({ foto_url: fotoPerfil }).eq("id", employeeId);
  const deps = (convite.dependentes || []).filter((d: any) => d?.nome?.trim());
  if (deps.length) {
    await db.from("employee_dependentes").insert(deps.map((d: any) => ({
      employee_id: employeeId, nome: d.nome.trim(), cpf: d.cpf || null, data_nascimento: d.data_nascimento || null, parentesco: d.parentesco || null,
    })));
  }
  await db.from("admissao_convites").update({ status: "aprovado", employee_id: employeeId, aprovado_em: new Date().toISOString() }).eq("id", convite.id);
  // As cópias ficam na ficha do funcionário; apaga as originais da pasta temporária
  if (copiados.length) await supabase.storage.from(BUCKET).remove(copiados);
  if (copiados.length < docs.length) toast.warning(`${docs.length - copiados.length} foto(s) não puderam ser copiadas. Veja em Admissão digital.`);
};

const NovoConvite = ({ aberto, onFechar, onCriado }: { aberto: boolean; onFechar: () => void; onCriado: (c: any) => void }) => {
  const [v, setV] = useState({ nome: "", telefone: "", cpf: "", cargo: "", setor: "", empresa_id: "", data_admissao_prevista: "" });
  const [salvando, setSalvando] = useState(false);
  const { data: listas } = useQuery({
    queryKey: ["listas-admissao"],
    enabled: aberto,
    queryFn: async () => {
      const [f, s, e] = await Promise.all([
        supabase.from("funcoes").select("nome").order("nome"),
        supabase.from("setores").select("nome").order("nome"),
        supabase.from("empresas").select("id, nome").order("nome"),
      ]);
      return { funcoes: f.data || [], setores: s.data || [], empresas: e.data || [] };
    },
  });
  useEffect(() => { if (aberto) setV({ nome: "", telefone: "", cpf: "", cargo: "", setor: "", empresa_id: "", data_admissao_prevista: "" }); }, [aberto]);

  const criar = async () => {
    if (!v.nome.trim()) return toast.error("Informe o nome");
    setSalvando(true);
    const registro: any = { nome: v.nome.trim() };
    for (const k of ["telefone", "cpf", "cargo", "setor", "empresa_id", "data_admissao_prevista"] as const) if (v[k]) registro[k] = v[k];
    const { data, error } = await db.from("admissao_convites").insert(registro).select("*, empresas(nome)").single();
    setSalvando(false);
    if (error) return toast.error("Erro ao criar: " + error.message);
    onCriado(data);
  };

  const sel = (campo: "cargo" | "setor" | "empresa_id", rotulo: string, opcoes: { valor: string; rotulo: string }[]) => (
    <div>
      <Label htmlFor={`nc-${campo}`} className="mb-1.5 block">{rotulo}</Label>
      <Select value={v[campo]} onValueChange={(x) => setV({ ...v, [campo]: x })}>
        <SelectTrigger id={`nc-${campo}`}><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>{opcoes.map((o) => <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova admissão por link</DialogTitle>
          <DialogDescription>O candidato recebe um link para preencher os próprios dados e enviar as fotos dos documentos.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="nc-nome" className="mb-1.5 block">Nome do candidato *</Label>
            <Input id="nc-nome" value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="nc-tel" className="mb-1.5 block">WhatsApp</Label>
            <Input id="nc-tel" type="tel" value={v.telefone} onChange={(e) => setV({ ...v, telefone: e.target.value })} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <Label htmlFor="nc-cpf" className="mb-1.5 block">CPF</Label>
            <Input id="nc-cpf" inputMode="numeric" value={v.cpf} onChange={(e) => setV({ ...v, cpf: e.target.value })} />
          </div>
          {sel("cargo", "Função", (listas?.funcoes || []).map((f: any) => ({ valor: f.nome, rotulo: f.nome })))}
          {sel("setor", "Setor", (listas?.setores || []).map((s: any) => ({ valor: s.nome, rotulo: s.nome })))}
          {sel("empresa_id", "Empresa", (listas?.empresas || []).map((e: any) => ({ valor: e.id, rotulo: e.nome })))}
          <div>
            <Label htmlFor="nc-data" className="mb-1.5 block">Admissão prevista</Label>
            <Input id="nc-data" type="date" value={v.data_admissao_prevista} onChange={(e) => setV({ ...v, data_admissao_prevista: e.target.value })} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={criar} disabled={salvando}>{salvando ? "Criando…" : "Criar link"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const LinkConvite = ({ convite, onFechar }: { convite: any | null; onFechar: () => void }) => (
  <Dialog open={!!convite} onOpenChange={(o) => !o && onFechar()}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Link de admissão de {convite?.nome}</DialogTitle>
        <DialogDescription>Envie para o candidato. O link vale até {convite?.expira_em ? dataBR(convite.expira_em).toLocaleDateString("pt-BR") : "—"}.</DialogDescription>
      </DialogHeader>
      {convite && (
        <div className="min-w-0 space-y-3">
          <div className="break-all rounded-md border bg-muted/50 p-3 font-mono text-sm">{linkDe(convite.codigo)}</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button onClick={() => abrirWhats(convite)}><MessageCircle className="mr-2 h-4 w-4" />Enviar no WhatsApp</Button>
            <Button variant="outline" onClick={() => copiar(linkDe(convite.codigo))}><Copy className="mr-2 h-4 w-4" />Copiar link</Button>
          </div>
        </div>
      )}
    </DialogContent>
  </Dialog>
);

const Conferir = ({ convite, onFechar, onAprovar, onReabrir }: { convite: any | null; onFechar: () => void; onAprovar: () => void; onReabrir: () => void }) => {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!convite) return;
    setUrls({});
    const docs: any[] = convite.documentos || [];
    if (!docs.length) return;
    supabase.storage.from(BUCKET).createSignedUrls(docs.map((d) => d.path), 60 * 30).then(({ data }) => {
      const m: Record<string, string> = {};
      (data || []).forEach((x: any) => { if (x.signedUrl && x.path) m[x.path] = x.signedUrl; });
      setUrls(m);
    });
  }, [convite]);
  if (!convite) return null;
  const dados = convite.dados || {};
  const grupos = [...GRUPOS_BASE, ...GRUPOS_FICHA]
    .map((g) => ({ ...g, campos: g.campos.filter((c) => c.candidato && dados[c.campo] !== undefined && dados[c.campo] !== "" && dados[c.campo] !== false) }))
    .filter((g) => g.campos.length);
  const deps = (convite.dependentes || []).filter((d: any) => d?.nome);
  const docs: any[] = convite.documentos || [];

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conferir admissão: {dados.nome_completo || convite.nome}</DialogTitle>
          <DialogDescription>Enviado em {dataHora(convite.preenchido_em)}. Confira os dados com as fotos antes de cadastrar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {grupos.map((g) => (
            <section key={g.chave}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.titulo}</h3>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {g.campos.map((c) => (
                  <div key={c.campo} className={c.largo ? "sm:col-span-2" : undefined}>
                    <dt className="text-xs text-muted-foreground">{c.rotulo.replace(" *", "")}</dt>
                    <dd className="font-medium break-words">{formatarValor(c, dados[c.campo])}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          {deps.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dependentes</h3>
              <ul className="space-y-1 text-sm">
                {deps.map((d: any, i: number) => (
                  <li key={i}><span className="font-medium">{d.nome}</span>{[d.parentesco, d.data_nascimento?.split("-").reverse().join("/"), d.cpf].filter(Boolean).map((x: string) => ` · ${x}`).join("")}</li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Fotos dos documentos ({docs.length})</h3>
            {docs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma foto enviada.</p> : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {docs.map((d) => {
                  const url = urls[d.path];
                  const pdf = d.path.toLowerCase().endsWith(".pdf");
                  return (
                    <a key={d.path} href={url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-lg border">
                      <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                        {url && !pdf ? <img src={url} alt={nomeTipoDocumento(d.tipo)} className="h-full w-full object-cover" loading="lazy" /> : url ? <FileText className="h-8 w-8 text-muted-foreground" /> : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                      </div>
                      <p className="flex items-center justify-between gap-1 p-2 text-xs font-medium"><span className="truncate">{nomeTipoDocumento(d.tipo)}</span><ExternalLink className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" /></p>
                    </a>
                  );
                })}
              </div>
            )}
          </section>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={onReabrir}><RotateCcw className="mr-2 h-4 w-4" />Devolver para o candidato corrigir</Button>
          <Button onClick={onAprovar}><ClipboardCheck className="mr-2 h-4 w-4" />Aprovar e cadastrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const AdmissaoDigital = () => {
  const qc = useQueryClient();
  const [novo, setNovo] = useState(false);
  const [link, setLink] = useState<any | null>(null);
  const [conferir, setConferir] = useState<any | null>(null);
  const [cadastrar, setCadastrar] = useState<any | null>(null);

  const { data: convites = [], isLoading } = useQuery({
    queryKey: ["admissao-convites"],
    queryFn: async () => {
      const { data, error } = await db.from("admissao_convites").select("*, empresas(nome)").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const recarregar = () => { qc.invalidateQueries({ queryKey: ["admissao-convites"] }); qc.invalidateQueries({ queryKey: ["documentos-vencendo"] }); };

  const hoje = todayISO();

  const mudarStatus = async (c: any, status: Status, extra: Record<string, any> = {}) => {
    const { error } = await db.from("admissao_convites").update({ status, ...extra }).eq("id", c.id);
    if (error) return toast.error("Erro: " + error.message);
    recarregar();
  };
  const reabrir = async (c: any) => {
    const novaValidade = new Date(); novaValidade.setDate(novaValidade.getDate() + 15);
    await mudarStatus(c, "aguardando", { expira_em: c.expira_em < hoje ? toISODateLocal(novaValidade) : c.expira_em });
    setConferir(null);
    toast.success("Link reaberto. Avise o candidato pelo WhatsApp.");
    setLink({ ...c, expira_em: c.expira_em < hoje ? toISODateLocal(novaValidade) : c.expira_em });
  };

  const dadosIniciais = (c: any) => {
    const d = { ...(c.dados || {}) };
    // só os campos conhecidos
    const conhecidos = new Set(CAMPOS_ADMISSAO.map((x) => x.campo));
    Object.keys(d).forEach((k) => { if (!conhecidos.has(k)) delete d[k]; });
    return {
      ...d,
      nome_completo: d.nome_completo || c.nome,
      cpf: d.cpf || c.cpf,
      telefone: d.telefone || c.telefone,
      cargo: c.cargo || "",
      setor: c.setor || "",
      empresa_id: c.empresa_id || "",
      data_admissao: c.data_admissao_prevista || "",
      status: "em_admissao",
      tipo_contrato: "fixo",
      experiencia_dias: 45,
      experiencia_prorrogacao_dias: 45,
    };
  };

  const [busca, setBusca] = useState("");
  const [verCancelados, setVerCancelados] = useState(false);
  const termo = busca.trim().toLowerCase();
  const filtrar = (x: any) => !termo || `${x.dados?.nome_completo || x.nome} ${x.cargo || ""} ${x.setor || ""}`.toLowerCase().includes(termo);
  const vencidoDe = (x: any) => x.status === "aguardando" && x.expira_em < hoje;
  const iniciais = (n: string) => String(n || "").split(" ").filter(Boolean).map((p, k, a) => (k === 0 || k === a.length - 1 ? p[0] : "")).join("").toUpperCase();
  const camposPreenchidos = (x: any) => Object.values(x.dados || {}).filter((v) => v !== "" && v !== null && v !== false).length;

  const colunas = [
    { chave: "aguardando", titulo: "Aguardando o candidato", faixa: "border-l-amber-400", linha: "border-b-amber-400", itens: convites.filter((x: any) => x.status === "aguardando" && !vencidoDe(x)) },
    { chave: "preenchido", titulo: "Para conferir", faixa: "border-l-violet-500", linha: "border-b-violet-500", itens: convites.filter((x: any) => x.status === "preenchido") },
    { chave: "vencido", titulo: "Link vencido", faixa: "border-l-sky-500", linha: "border-b-sky-500", itens: convites.filter(vencidoDe) },
    { chave: "aprovado", titulo: "Cadastrados", faixa: "border-l-emerald-500", linha: "border-b-emerald-500", itens: convites.filter((x: any) => x.status === "aprovado").slice(0, 12) },
  ].map((c) => ({ ...c, itens: c.itens.filter(filtrar) }));
  const cancelados = convites.filter((x: any) => x.status === "cancelado").filter(filtrar);

  const Cartao = ({ c, faixa }: { c: any; faixa: string }) => {
    const nome = c.dados?.nome_completo || c.nome;
    const vencido = vencidoDe(c);
    const info = c.status === "preenchido" ? `recebido ${dataBR(c.preenchido_em?.slice(0, 10) || hoje).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
      : c.status === "aprovado" ? `cadastrado ${dataBR(c.aprovado_em?.slice(0, 10) || hoje).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
      : vencido ? `venceu ${dataBR(c.expira_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
      : `vale até ${dataBR(c.expira_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
    return (
      <div className={`flex flex-col gap-3 rounded-lg border-l-4 ${faixa} bg-card p-3 pl-3.5 shadow-[0_1px_2px_rgba(20,24,40,0.06)]`}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{iniciais(nome)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{nome}</p>
            <p className="truncate text-xs text-muted-foreground">{[c.cargo, c.setor].filter(Boolean).join(" · ") || "Sem função definida"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground"><ClipboardCheck className="h-3 w-3" />{camposPreenchidos(c)} campos · {(c.documentos || []).length} fotos</span>
          <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground"><CalendarDays className="h-3 w-3" />{info}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {c.status === "aguardando" && !vencido && <Button size="sm" variant="outline" className="h-8" onClick={() => setLink(c)}><MessageCircle className="h-3.5 w-3.5" />Enviar link</Button>}
          {vencido && <Button size="sm" variant="outline" className="h-8" onClick={() => reabrir(c)}><RotateCcw className="h-3.5 w-3.5" />Renovar link</Button>}
          {c.status === "aguardando" && <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => { if (confirm(`Cancelar a admissão de ${c.nome}? O link deixa de funcionar.`)) mudarStatus(c, "cancelado"); }}><XCircle className="h-3.5 w-3.5" />Cancelar</Button>}
          {c.status === "preenchido" && <Button size="sm" className="h-8" onClick={() => setConferir(c)}><ClipboardCheck className="h-3.5 w-3.5" />Conferir</Button>}
          {c.status === "aprovado" && c.employee_id && <Button size="sm" variant="outline" className="h-8" asChild><Link to={`/employee/${c.employee_id}`}><CheckCircle2 className="h-3.5 w-3.5" />Ver ficha</Link></Button>}
          {c.status === "cancelado" && <Button size="sm" variant="outline" className="h-8" onClick={() => reabrir(c)}><RotateCcw className="h-3.5 w-3.5" />Reativar</Button>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-medium"><UserPlus className="h-5 w-5 text-primary" />Admissão digital</h1>
          <p className="text-sm text-muted-foreground">O novo colaborador preenche os dados e manda as fotos dos documentos pelo link. Você confere e cadastra.</p>
        </div>
        <Button onClick={() => setNovo(true)} className="h-10 px-5 text-[11px] font-bold uppercase tracking-[0.04em]"><Plus className="h-4 w-4" />Nova admissão por link</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Buscar admissão" placeholder="Procure por candidato, cargo ou setor" value={busca} onChange={(e) => setBusca(e.target.value)} className="h-10 rounded-full border-0 bg-[hsl(228_14%_92%)] pl-10" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid items-start gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {colunas.map((col) => (
            <section key={col.chave} className="flex min-w-0 flex-col gap-2.5">
              <h2 className={`mb-1 w-fit border-b-[3px] ${col.linha} pb-2 text-sm font-medium`}>{col.titulo} ({col.itens.length})</h2>
              {col.itens.length === 0
                ? <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">Nenhum</p>
                : col.itens.map((c: any) => <Cartao key={c.id} c={c} faixa={col.faixa} />)}
            </section>
          ))}
        </div>
      )}

      {cancelados.length > 0 && (
        <div className="space-y-2.5">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setVerCancelados(!verCancelados)}>
            {verCancelados ? "Esconder" : "Mostrar"} cancelados ({cancelados.length})
          </Button>
          {verCancelados && <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">{cancelados.map((c: any) => <Cartao key={c.id} c={c} faixa="border-l-slate-300" />)}</div>}
        </div>
      )}

      <NovoConvite aberto={novo} onFechar={() => setNovo(false)} onCriado={(c) => { setNovo(false); recarregar(); setLink(c); }} />
      <LinkConvite convite={link} onFechar={() => setLink(null)} />
      <Conferir convite={conferir} onFechar={() => setConferir(null)} onReabrir={() => reabrir(conferir)} onAprovar={() => { setCadastrar(conferir); setConferir(null); }} />

      <Dialog open={!!cadastrar} onOpenChange={(o) => !o && setCadastrar(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0 sm:p-0">
          <DialogHeader className="sr-only"><DialogTitle>Cadastrar funcionário</DialogTitle></DialogHeader>
          {cadastrar && (
            <EmployeeForm
              initialData={dadosIniciais(cadastrar)}
              onCreated={(id) => concluirAdmissao(cadastrar, id)}
              onSaved={() => { setCadastrar(null); recarregar(); toast.success("Admissão concluída: documentos e dependentes foram para a ficha."); }}
              onCancel={() => setCadastrar(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdmissaoDigital;

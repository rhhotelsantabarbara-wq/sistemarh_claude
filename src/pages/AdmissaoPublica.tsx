import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, FileCheck2, Loader2, Plus, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import CamposFicha from "@/components/forms/employee-tabs/CamposFicha";
import { DependenteCampos, type Dependente } from "@/components/employees/tabs/DependentesTab";
import { GRUPOS_BASE, grupo } from "@/lib/fichaCampos";
import { TIPOS_DOCUMENTO } from "@/lib/documentosTipos";

type Estado = "carregando" | "form" | "invalido" | "enviado" | "expirado" | "enviado_antes";

interface DocEnviado { tipo: string; path: string; nome: string }

const rpc = (fn: string, args: Record<string, unknown>) => (supabase.rpc as any)(fn, args);
const DOCS_ADMISSAO = TIPOS_DOCUMENTO.filter((t) => t.admissao);
const OBRIGATORIOS_DADOS: [string, string][] = [
  ["nome_completo", "nome completo"], ["cpf", "CPF"], ["data_nascimento", "data de nascimento"],
  ["telefone", "celular"], ["nome_mae", "nome da mãe"],
];

const ETAPAS = [
  { chave: "pessoais", titulo: "Seus dados" },
  { chave: "documentos", titulo: "Documentos" },
  { chave: "endereco", titulo: "Endereço" },
  { chave: "banco", titulo: "Banco e outros" },
  { chave: "dependentes", titulo: "Dependentes" },
  { chave: "fotos", titulo: "Fotos dos documentos" },
  { chave: "revisar", titulo: "Revisar e enviar" },
];

/** Diminui fotos grandes antes de enviar (celular tira fotos de 4 a 8 MB) */
const comprimir = async (arquivo: File): Promise<Blob> => {
  if (!arquivo.type.startsWith("image/") || arquivo.size < 900 * 1024) return arquivo;
  try {
    const bmp = await createImageBitmap(arquivo);
    const escala = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob && blob.size < arquivo.size ? blob : arquivo;
  } catch {
    return arquivo; // ex.: HEIC em navegador que não abre: envia o original
  }
};

const AdmissaoPublica = () => {
  const { codigo } = useParams();
  const [estado, setEstado] = useState<Estado>("carregando");
  const [info, setInfo] = useState<any>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [dependentes, setDependentes] = useState<Dependente[]>([]);
  const [documentos, setDocumentos] = useState<DocEnviado[]>([]);
  const [etapa, setEtapa] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState<string | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);
  const tipoFoto = useRef<string>("");

  useEffect(() => {
    (async () => {
      const { data, error } = await rpc("admissao_abrir", { p_codigo: codigo });
      if (error || !data) return setEstado("invalido");
      if (data.erro === "enviado") { setInfo(data); return setEstado("enviado_antes"); }
      if (data.erro === "expirado") { setInfo(data); return setEstado("expirado"); }
      if (data.erro) return setEstado("invalido");
      setInfo(data);
      const v: Record<string, string> = {};
      Object.entries(data.dados || {}).forEach(([k, x]) => { v[k] = x === null || x === undefined ? "" : String(x); });
      if (!v.nome_completo) v.nome_completo = data.nome || "";
      if (!v.cpf && data.cpf) v.cpf = data.cpf;
      if (!v.telefone && data.telefone) v.telefone = data.telefone;
      if (!v.nacionalidade) v.nacionalidade = "Brasileiro(a)";
      setValores(v);
      setDependentes(data.dependentes || []);
      setDocumentos(data.documentos || []);
      setEstado("form");
    })();
  }, [codigo]);

  const mudar = (campo: string, valor: string) => {
    setValores((p) => ({ ...p, [campo]: valor }));
    if (campo === "cep") {
      const cep = valor.replace(/\D/g, "");
      if (cep.length === 8) {
        fetch(`https://viacep.com.br/ws/${cep}/json/`).then((r) => r.json()).then((d) => {
          if (d?.erro) return;
          setValores((p) => ({
            ...p,
            endereco: p.endereco || d.logradouro || "",
            bairro: p.bairro || d.bairro || "",
            cidade: p.cidade || d.localidade || "",
            uf: p.uf || d.uf || "",
          }));
        }).catch(() => { /* sem internet para o CEP: preenche à mão */ });
      }
    }
  };

  const dadosParaSalvar = () => {
    const d: Record<string, any> = {};
    Object.entries(valores).forEach(([k, v]) => {
      if (v === "true" || v === "false") d[k] = v === "true";
      else if (v.trim() !== "") d[k] = v.trim();
    });
    return d;
  };

  const salvar = async (finalizar: boolean) => {
    const { error } = await rpc("admissao_salvar", {
      p_codigo: codigo,
      p_dados: dadosParaSalvar(),
      p_dependentes: dependentes.filter((d) => d.nome.trim()),
      p_documentos: documentos,
      p_finalizar: finalizar,
    });
    if (error) throw error;
  };

  const irPara = async (nova: number) => {
    setSalvando(true);
    try {
      await salvar(false); // rascunho: dá para fechar e continuar depois pelo mesmo link
    } catch (e: any) {
      toast.error(e.message || "Não foi possível salvar. Confira sua internet.");
      setSalvando(false);
      return;
    }
    setSalvando(false);
    setEtapa(nova);
    window.scrollTo({ top: 0 });
  };

  const faltando = useMemo(() => {
    const f: string[] = OBRIGATORIOS_DADOS.filter(([k]) => !(valores[k] || "").trim()).map(([, r]) => r);
    DOCS_ADMISSAO.filter((t) => t.admissao === "obrigatorio" && !documentos.some((d) => d.tipo === t.chave)).forEach((t) => f.push(`foto: ${t.nome}`));
    return f;
  }, [valores, documentos]);

  const enviar = async () => {
    if (faltando.length) return toast.error("Falta preencher: " + faltando.join(", "));
    setSalvando(true);
    try {
      await salvar(true);
      setEstado("enviado");
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    } finally {
      setSalvando(false);
    }
  };

  const escolherFoto = (tipo: string) => {
    tipoFoto.current = tipo;
    inputFoto.current?.click();
  };

  const enviarFoto = async (arquivo?: File) => {
    const tipo = tipoFoto.current;
    if (!arquivo || !tipo) return;
    if (arquivo.size > 25 * 1024 * 1024) return toast.error("Arquivo muito grande (máximo 25 MB)");
    setEnviandoFoto(tipo);
    try {
      const blob = await comprimir(arquivo);
      const ext = blob.type === "image/jpeg" ? "jpg" : (arquivo.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${codigo}/${tipo}-${Date.now()}.${ext}`;
      if (blob.size > 10 * 1024 * 1024) throw new Error("Arquivo muito grande (máximo 10 MB). Tire uma foto em vez de enviar o arquivo.");
      const { error } = await supabase.storage.from("admissao-documentos").upload(path, blob, { contentType: blob.type || arquivo.type || undefined });
      if (error) throw error;
      const novos = [...documentos, { tipo, path, nome: arquivo.name }];
      setDocumentos(novos);
      await rpc("admissao_salvar", { p_codigo: codigo, p_dados: dadosParaSalvar(), p_dependentes: dependentes.filter((d) => d.nome.trim()), p_documentos: novos, p_finalizar: false });
      toast.success("Foto enviada");
    } catch (e: any) {
      toast.error(e.message || "Não foi possível enviar a foto");
    } finally {
      setEnviandoFoto(null);
      if (inputFoto.current) inputFoto.current.value = "";
    }
  };

  const tela = (conteudo: React.ReactNode) => (
    <div className="min-h-screen bg-muted/30 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-4">{conteudo}</div>
    </div>
  );

  if (estado === "carregando") return <div className="flex min-h-screen items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Abrindo…</div>;
  if (estado === "invalido") return tela(<Card className="p-8 text-center"><h1 className="mb-2 text-xl font-bold">Link inválido</h1><p className="text-muted-foreground">Confira se o link está completo ou peça um novo ao RH.</p></Card>);
  if (estado === "expirado") return tela(<Card className="p-8 text-center"><h1 className="mb-2 text-xl font-bold">Link vencido</h1><p className="text-muted-foreground">Este link de admissão passou do prazo. Peça um novo ao RH.</p></Card>);
  if (estado === "enviado" || estado === "enviado_antes") return tela(
    <Card className="p-8 text-center">
      <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-emerald-600" />
      <h1 className="mb-2 text-2xl font-bold">{estado === "enviado" ? "Recebemos seus dados!" : "Seus dados já foram enviados"}</h1>
      <p className="text-muted-foreground">O RH vai conferir as informações e entrar em contato. Se precisar corrigir algo, fale com o RH.</p>
    </Card>,
  );

  const atual = ETAPAS[etapa].chave;
  const docsFeitos = (tipo: string) => documentos.filter((d) => d.tipo === tipo);

  return tela(<>
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><UserPlus className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">Bem-vindo(a), {(info?.nome || "").split(" ")[0]}!</h1>
          <p className="text-sm text-muted-foreground">
            Preencha seus dados para a admissão{info?.cargo ? ` como ${info.cargo}` : ""}{info?.empresa ? ` (${info.empresa})` : ""}.
            Tudo é salvo a cada etapa: se precisar parar, abra o mesmo link depois.
          </p>
        </div>
      </div>
      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{ETAPAS[etapa].titulo}</span>
          <span className="text-muted-foreground">Etapa {etapa + 1} de {ETAPAS.length}</span>
        </div>
        <Progress value={((etapa + 1) / ETAPAS.length) * 100} aria-label="Progresso" />
      </div>
    </Card>

    <Card className="p-5 sm:p-6">
      {atual === "pessoais" && <CamposFicha grupos={[GRUPOS_BASE[0], grupo("pessoais"), grupo("emergencia"), grupo("pcd")]} valores={valores} onChange={mudar} somenteCandidato />}
      {atual === "documentos" && <CamposFicha grupos={[GRUPOS_BASE[1], grupo("documentos")]} valores={valores} onChange={mudar} somenteCandidato />}
      {atual === "endereco" && <CamposFicha grupos={[GRUPOS_BASE[2]]} valores={valores} onChange={mudar} somenteCandidato />}
      {atual === "banco" && (
        <>
          <p className="mb-4 text-sm text-muted-foreground">Se ainda não tem conta, deixe em branco: o RH orienta a abertura da conta salário.</p>
          <CamposFicha grupos={[grupo("banco"), { ...grupo("contrato"), titulo: "Trabalho" }, grupo("beneficios"), grupo("tamanhos")]} valores={valores} onChange={mudar} somenteCandidato />
        </>
      )}
      {atual === "dependentes" && (
        <div className="space-y-4">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><Users className="h-5 w-5" /> Dependentes</h2>
            <p className="text-sm text-muted-foreground">Filhos, cônjuge ou outras pessoas que dependem de você. Se não tiver, pule esta etapa.</p>
          </div>
          {dependentes.map((d, i) => (
            <div key={i} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Dependente {i + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => setDependentes(dependentes.filter((_, j) => j !== i))}><Trash2 className="mr-1 h-4 w-4" />Remover</Button>
              </div>
              <DependenteCampos simples valor={d} onChange={(nd) => setDependentes(dependentes.map((x, j) => (j === i ? nd : x)))} />
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={() => setDependentes([...dependentes, { nome: "" }])}><Plus className="mr-1 h-4 w-4" />Adicionar dependente</Button>
        </div>
      )}
      {atual === "fotos" && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold">Fotos dos documentos</h2>
            <p className="text-sm text-muted-foreground">Tire uma foto nítida de cada documento, em um lugar claro. Pode enviar mais de uma foto (frente e verso).</p>
          </div>
          <input ref={inputFoto} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => enviarFoto(e.target.files?.[0])} />
          <ul className="space-y-2">
            {DOCS_ADMISSAO.map((t) => {
              const feitos = docsFeitos(t.chave);
              return (
                <li key={t.chave} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {t.nome}
                      {t.admissao === "obrigatorio" ? <Badge variant="outline" className="font-normal">Obrigatório</Badge> : <span className="text-xs font-normal text-muted-foreground">se tiver</span>}
                    </p>
                    {t.dica && <p className="text-xs text-muted-foreground">{t.dica}</p>}
                    {feitos.length > 0 && <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400"><FileCheck2 className="h-3.5 w-3.5" />{feitos.length} {feitos.length === 1 ? "foto enviada" : "fotos enviadas"}</p>}
                  </div>
                  <Button type="button" variant={!feitos.length && t.admissao === "obrigatorio" ? "default" : "outline"} className="shrink-0" disabled={!!enviandoFoto} onClick={() => escolherFoto(t.chave)}>
                    {enviandoFoto === t.chave ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                    {feitos.length ? "Enviar outra" : "Enviar foto"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {atual === "revisar" && (
        <div className="space-y-4">
          <h2 className="font-semibold">Tudo certo?</h2>
          {faltando.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
              <p className="mb-1 font-medium">Ainda falta:</p>
              <ul className="list-inside list-disc">{faltando.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Seus dados e fotos estão prontos. Ao enviar, o RH recebe tudo para conferir. Depois de enviado, só o RH pode alterar.</p>
          )}
          <dl className="grid grid-cols-1 gap-3 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-2">
            {[["Nome", valores.nome_completo], ["CPF", valores.cpf], ["Nascimento", valores.data_nascimento?.split("-").reverse().join("/")], ["Celular", valores.telefone], ["Cidade", [valores.cidade, valores.uf].filter(Boolean).join(" - ")], ["Dependentes", String(dependentes.filter((d) => d.nome.trim()).length)], ["Fotos enviadas", String(documentos.length)]].map(([r, v]) => (
              <div key={r}><dt className="text-muted-foreground">{r}</dt><dd className="font-medium break-words">{v || "—"}</dd></div>
            ))}
          </dl>
          <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Seus dados são usados só para o seu registro de trabalho e ficam guardados com segurança, conforme a LGPD.</p>
        </div>
      )}
    </Card>

    <div className="flex gap-3">
      {etapa > 0 && <Button variant="outline" className="h-12 flex-1" disabled={salvando} onClick={() => irPara(etapa - 1)}><ArrowLeft className="mr-1 h-4 w-4" />Voltar</Button>}
      {etapa < ETAPAS.length - 1 ? (
        <Button className="h-12 flex-1" disabled={salvando} onClick={() => irPara(etapa + 1)}>
          {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Continuar<ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      ) : (
        <Button className="h-12 flex-1" disabled={salvando || faltando.length > 0} onClick={enviar}>
          {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Enviar para o RH
        </Button>
      )}
    </div>
  </>);
};

export default AdmissaoPublica;

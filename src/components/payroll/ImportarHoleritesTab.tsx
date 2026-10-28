import { useEffect, useMemo, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileCheck2, Eye, Loader2, Save, Upload, Check, ChevronsUpDown, Sparkles, AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { competenciaDoTexto, nomeProvavel, vincularPorTexto, type ComoEncontrou } from "@/lib/holeriteVinculo";
import { toast } from "sonner";

(pdfjsLib as typeof pdfjsLib & { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = workerSrc;

const MESES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface Empresa {
  id: string;
  nome: string;
}

interface Employee {
  id: string;
  nome_completo: string;
  cpf: string | null;
  empresa_id: string | null;
}

type PageStatus = "aguardando_vinculo" | "ok" | "ja_existe" | "sem_periodo";

interface PageHolerite {
  pagina: number;
  employee_id: string | null;
  employee_nome: string | null;
  empresa_id: string | null;
  mes: number | null;
  ano: number | null;
  tipo_folha: string;
  status: PageStatus;
  selecionado: boolean;
  /** como o sistema achou o funcionário sozinho (null = escolhido à mão ou não achou) */
  como?: ComoEncontrou | null;
  /** nome lido na página, para ajudar quando não achou */
  nome_lido?: string | null;
}

const COMO_ROTULO: Record<ComoEncontrou, string> = {
  cpf: "Achado pelo CPF",
  nome: "Achado pelo nome",
  nome_parecido: "Nome parecido: confira",
};

/** Lista de funcionários com busca por digitação */
function EscolherFuncionario({ valor, lista, onEscolher }: { valor: string | null; lista: Employee[]; onEscolher: (id: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const atual = lista.find((e) => e.id === valor);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={aberto} className="h-9 w-full justify-between font-normal">
          <span className={`truncate ${atual ? "" : "text-muted-foreground"}`}>{atual ? atual.nome_completo : "Escolha o funcionário"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(380px,90vw)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Digite o nome ou CPF…" />
          <CommandList>
            <CommandEmpty>Ninguém encontrado.</CommandEmpty>
            <CommandGroup>
              {lista.map((e) => (
                <CommandItem key={e.id} value={`${e.nome_completo} ${e.cpf || ""} ${e.id}`} onSelect={() => { onEscolher(e.id); setAberto(false); }}>
                  <Check className={`mr-2 h-4 w-4 ${e.id === valor ? "opacity-100" : "opacity-0"}`} />
                  <span className="truncate">{e.nome_completo}</span>
                  {e.cpf && <span className="ml-auto pl-2 text-xs text-muted-foreground">{e.cpf}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Texto da página, linha por linha */
async function textoDaPagina(pdf: any, numero: number): Promise<string> {
  const page = await pdf.getPage(numero);
  const tc = await page.getTextContent();
  let out = "";
  for (const item of tc.items as any[]) {
    out += (item.str || "") + (item.hasEOL ? "\n" : " ");
  }
  return out;
}

interface ImportarHoleritesTabProps {
  onImportComplete?: (holerites: unknown[]) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" && file.name.toLowerCase().endsWith(".pdf");
}

function statusBadge(status: PageStatus) {
  if (status === "ok") return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Pronto</Badge>;
  if (status === "ja_existe") return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Já existe</Badge>;
  if (status === "sem_periodo") return <Badge variant="outline">Defina o período</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Escolha o funcionário</Badge>;
}

export function ImportarHoleritesTab(_props: ImportarHoleritesTabProps = {}) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empresaDefault, setEmpresaDefault] = useState("");
  const [mesDefault, setMesDefault] = useState(new Date().getMonth() + 1);
  const [anoDefault, setAnoDefault] = useState(new Date().getFullYear());
  const [file, setFile] = useState<File | null>(null);
  const [paginas, setPaginas] = useState<PageHolerite[]>([]);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sobrescrever, setSobrescrever] = useState(false);
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [soFaltando, setSoFaltando] = useState(false);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    void (async () => {
      const [{ data: empresasData }, { data: employeesData }] = await Promise.all([
        supabase.from("empresas").select("id, nome").order("nome"),
        supabase.from("employees").select("id, nome_completo, cpf, empresa_id").order("nome_completo"),
      ]);
      setEmpresas(empresasData || []);
      setEmployees(employeesData || []);
    })();
  }, []);

  const employeesDisponiveis = empresaDefault
    ? employees.filter((employee) => employee.empresa_id === empresaDefault)
    : employees;

  const isSelecionavel = (pagina: PageHolerite) =>
    pagina.status === "ok" || (pagina.status === "ja_existe" && sobrescrever);

  useEffect(() => {
    setPaginas((atuais) => atuais.map((pagina) => ({
      ...pagina,
      selecionado: pagina.status === "ok" || (pagina.status === "ja_existe" && sobrescrever),
    })));
  }, [sobrescrever]);

  async function verificarExistente(employeeId: string, mes: number | null, ano: number | null) {
    if (!mes || !ano) return false;
    const { data, error } = await supabase
      .from("holerite_documentos" as never)
      .select("id")
      .eq("employee_id", employeeId)
      .eq("mes", mes)
      .eq("ano", ano)
      .eq("tipo_folha", "salario")
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  async function handleProcessar() {
    if (!file) {
      toast.error("Selecione um PDF primeiro");
      return;
    }
    if (!isPdfFile(file)) {
      setFile(null);
      setPaginas([]);
      toast.error("Somente holerites em PDF podem ser disponibilizados");
      return;
    }
    setProcessing(true);
    setPaginas([]);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      const novasPaginas: PageHolerite[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        let texto = "";
        try { texto = await textoDaPagina(pdf, n); } catch { /* página sem texto: fica para escolher à mão */ }
        // Procura primeiro na empresa escolhida; se não achar, em todas
        const achado = vincularPorTexto(texto, employeesDisponiveis) || (empresaDefault ? vincularPorTexto(texto, employees) : null);
        const funcionario = achado ? employees.find((e) => e.id === achado.employee_id) : null;
        const comp = competenciaDoTexto(texto);
        novasPaginas.push({
          pagina: n,
          employee_id: funcionario?.id || null,
          employee_nome: funcionario?.nome_completo || null,
          empresa_id: funcionario?.empresa_id || empresaDefault || null,
          mes: comp?.mes ?? mesDefault,
          ano: comp?.ano ?? anoDefault,
          tipo_folha: "salario",
          status: "aguardando_vinculo",
          selecionado: false,
          como: achado?.como || null,
          nome_lido: funcionario ? null : nomeProvavel(texto),
        });
      }

      // Confere de uma vez quem já tem holerite nessa competência
      const ids = Array.from(new Set(novasPaginas.map((p) => p.employee_id).filter(Boolean))) as string[];
      const existentes = new Set<string>();
      if (ids.length) {
        const anos = Array.from(new Set(novasPaginas.map((p) => p.ano).filter(Boolean))) as number[];
        const { data } = await supabase
          .from("holerite_documentos" as never)
          .select("employee_id, mes, ano")
          .in("employee_id", ids)
          .in("ano", anos)
          .eq("tipo_folha", "salario");
        ((data as any[]) || []).forEach((d) => existentes.add(`${d.employee_id}:${d.mes}:${d.ano}`));
      }
      // O mesmo funcionário em duas páginas: a segunda fica para conferir
      const vistos = new Set<string>();
      for (const p of novasPaginas) {
        if (!p.employee_id) continue;
        if (vistos.has(p.employee_id)) { p.employee_id = null; p.employee_nome = null; p.como = null; continue; }
        vistos.add(p.employee_id);
        p.status = !p.mes || !p.ano ? "sem_periodo" : existentes.has(`${p.employee_id}:${p.mes}:${p.ano}`) ? "ja_existe" : "ok";
        p.selecionado = p.status === "ok" || (p.status === "ja_existe" && sobrescrever);
      }
      setPaginas(novasPaginas);
      const auto = novasPaginas.filter((p) => p.employee_id).length;
      const faltam = novasPaginas.length - auto;
      if (auto === 0) toast.warning(`${pdf.numPages} página(s) separada(s), mas não deu para ler os nomes. Vincule à mão.`);
      else toast.success(`${pdf.numPages} página(s): ${auto} vinculada(s) sozinha(s)${faltam ? `, ${faltam} para escolher` : ""}.`);
      if (faltam) setSoFaltando(false);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível abrir este PDF. Verifique se o arquivo não está protegido.");
    } finally {
      setProcessing(false);
    }
  }

  async function vincularManual(index: number, employeeId: string) {
    const employee = employees.find((item) => item.id === employeeId);
    const pagina = paginas[index];
    if (!employee || !pagina) return;

    try {
      const jaExiste = await verificarExistente(employeeId, pagina.mes, pagina.ano);
      const status: PageStatus = !pagina.mes || !pagina.ano ? "sem_periodo" : jaExiste ? "ja_existe" : "ok";
      setPaginas((atuais) => atuais.map((item, itemIndex) => itemIndex === index ? {
        ...item,
        employee_id: employee.id,
        employee_nome: employee.nome_completo,
        empresa_id: employee.empresa_id,
        como: null,
        status,
        selecionado: status === "ok" || (status === "ja_existe" && sobrescrever),
      } : item));
      if (jaExiste) toast.warning(`${employee.nome_completo}: já existe um holerite nessa competência.`);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível verificar o holerite deste funcionário");
    }
  }

  async function atualizarPeriodo(index: number, patch: { mes?: number | null; ano?: number | null }) {
    const pagina = paginas[index];
    if (!pagina) return;
    const mes = patch.mes !== undefined ? patch.mes : pagina.mes;
    const ano = patch.ano !== undefined ? patch.ano : pagina.ano;
    let status: PageStatus = pagina.employee_id ? "ok" : "aguardando_vinculo";
    if (!mes || !ano) status = "sem_periodo";
    else if (pagina.employee_id && await verificarExistente(pagina.employee_id, mes, ano)) status = "ja_existe";

    setPaginas((atuais) => atuais.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      mes,
      ano,
      status,
      selecionado: status === "ok" || (status === "ja_existe" && sobrescrever),
    } : item));
  }

  async function handleImportar() {
    const selecionadas = paginas.filter((pagina) => pagina.selecionado && isSelecionavel(pagina));
    if (!file || selecionadas.length === 0) {
      toast.error("Vincule e selecione ao menos uma página");
      return;
    }
    if (!isPdfFile(file)) {
      toast.error("Somente holerites em PDF podem ser disponibilizados");
      return;
    }
    if (selecionadas.some((pagina) => !pagina.employee_id || !pagina.empresa_id || !pagina.mes || !pagina.ano)) {
      toast.error("Todas as páginas selecionadas precisam de funcionário e competência");
      return;
    }

    setSaving(true);
    try {
      const pdfBase64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("holerite-importar-pdf-confirmar", {
        body: { holerites: selecionadas, sobrescrever, pdf_base64: pdfBase64, nome_arquivo: file.name },
      });
      if (error) {
        let message = error.message || "Erro ao importar";
        try {
          const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
          const body = context?.json ? await context.json() : null;
          if (body?.error) message = body.error;
        } catch {
          // Mantém a mensagem original quando o corpo não for JSON.
        }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);

      const vinculados = data?.vinculados ?? 0;
      const pulados = data?.pulados ?? 0;
      const erros = data?.total_erros ?? 0;
      toast.success(`${vinculados} holerite(s) disponibilizado(s), ${pulados} ignorado(s), ${erros} erro(s).`);
      setPaginas([]);
      setFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao importar");
    } finally {
      setSaving(false);
    }
  }

  const totalSelecionados = paginas.filter((pagina) => pagina.selecionado && isSelecionavel(pagina)).length;
  const totalVinculados = paginas.filter((pagina) => pagina.employee_id).length;
  const totalJaExiste = paginas.filter((pagina) => pagina.status === "ja_existe").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-primary" />
            Importar holerites para assinatura
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cada página vira um holerite separado. O sistema lê o nome e o CPF de cada página e já vincula ao funcionário; você só confere e escolhe os que ele não achar.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <Label>Empresa</Label>
              <Select value={empresaDefault} onValueChange={setEmpresaDefault}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((empresa) => <SelectItem key={empresa.id} value={empresa.id}>{empresa.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mês</Label>
              <Select value={String(mesDefault)} onValueChange={(value) => setMesDefault(Number(value))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((mes) => (
                    <SelectItem key={mes} value={String(mes)}>{MESES[mes]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ano</Label>
              <Input type="number" value={anoDefault} onChange={(event) => setAnoDefault(Number(event.target.value))} />
            </div>
            <div>
              <Label>Arquivo PDF</Label>
              <Input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => {
                  const selectedFile = event.target.files?.[0] || null;
                  if (selectedFile && !isPdfFile(selectedFile)) {
                    event.target.value = "";
                    setFile(null);
                    setPaginas([]);
                    toast.error("Somente holerites em PDF podem ser disponibilizados");
                    return;
                  }
                  setFile(selectedFile);
                  setPaginas([]);
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleProcessar} disabled={!file || processing}>
              {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {processing ? "Separando páginas..." : "Separar páginas"}
            </Button>
            {paginas.length > 0 && (
              <Button onClick={handleImportar} disabled={saving || totalSelecionados === 0}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? "Importando..." : `Importar ${totalSelecionados} para assinatura`}
              </Button>
            )}
          </div>

          {paginas.length > 0 && (
            <div className="grid gap-3 rounded border bg-muted/30 p-3 md:grid-cols-2">
              <div className="text-sm">
                <b>{paginas.length}</b> página(s) separada(s) · <b>{totalVinculados}</b> vinculada(s)
                {paginas.length - totalVinculados > 0 && <> · <b className="text-amber-700">{paginas.length - totalVinculados}</b> sem funcionário</>}
                <label className="mt-2 flex cursor-pointer items-center gap-2">
                  <Checkbox checked={soFaltando} onCheckedChange={(v) => setSoFaltando(Boolean(v))} />
                  Mostrar só as páginas para conferir
                </label>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="sobrescrever-toggle" checked={sobrescrever} onCheckedChange={(value) => setSobrescrever(Boolean(value))} />
                <Label htmlFor="sobrescrever-toggle" className="cursor-pointer text-sm leading-5">
                  Sobrescrever holerites já existentes
                  {totalJaExiste > 0 && <span className="block font-normal text-muted-foreground">Documentos assinados serão preservados.</span>}
                </Label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {paginas.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Vincular páginas aos funcionários</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Página</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-center">Visualizar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginas.map((pagina, index) => (soFaltando && pagina.employee_id && pagina.como !== "nome_parecido") ? null : (
                  <TableRow key={pagina.pagina} className={!pagina.employee_id ? "bg-amber-50/50 dark:bg-amber-950/20" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={pagina.selecionado}
                        disabled={!isSelecionavel(pagina)}
                        onCheckedChange={(value) => setPaginas((atuais) => atuais.map((item, itemIndex) => itemIndex === index ? { ...item, selecionado: Boolean(value) } : item))}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{pagina.pagina}</TableCell>
                    <TableCell className="min-w-72">
                      <EscolherFuncionario valor={pagina.employee_id} lista={employeesDisponiveis.some((e) => e.id === pagina.employee_id) ? employeesDisponiveis : employees} onEscolher={(id) => void vincularManual(index, id)} />
                      {pagina.como && (
                        <p className={`mt-1 flex items-center gap-1 text-xs ${pagina.como === "nome_parecido" ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                          <Sparkles className="h-3 w-3" />{COMO_ROTULO[pagina.como]}
                        </p>
                      )}
                      {!pagina.employee_id && pagina.nome_lido && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><AlertCircle className="h-3 w-3" />No holerite: <b className="font-medium">{pagina.nome_lido}</b></p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-44 items-center gap-2">
                        <Select value={pagina.mes ? String(pagina.mes) : ""} onValueChange={(value) => void atualizarPeriodo(index, { mes: Number(value) })}>
                          <SelectTrigger className="h-9 w-20"><SelectValue placeholder="Mês" /></SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, monthIndex) => monthIndex + 1).map((mes) => (
                              <SelectItem key={mes} value={String(mes)}>{MESES[mes]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          className="h-9 w-24"
                          value={pagina.ano ?? ""}
                          onChange={(event) => setPaginas((atuais) => atuais.map((item, itemIndex) => itemIndex === index ? { ...item, ano: event.target.value ? Number(event.target.value) : null } : item))}
                          onBlur={(event) => void atualizarPeriodo(index, { ano: event.target.value ? Number(event.target.value) : null })}
                        />
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(pagina.status)}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" onClick={() => setPreviewPage(pagina.pagina)} title={`Visualizar página ${pagina.pagina}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={previewPage !== null} onOpenChange={(open) => !open && setPreviewPage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Holerite da página {previewPage}</DialogTitle></DialogHeader>
          {previewUrl && previewPage && (
            <iframe
              title={`Página ${previewPage} do PDF`}
              src={`${previewUrl}#page=${previewPage}&view=FitH`}
              className="h-[70vh] w-full rounded border"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
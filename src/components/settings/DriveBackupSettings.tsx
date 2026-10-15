import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, RefreshCw, Upload, ExternalLink, HardDrive, Link2, Unlink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RetroactiveBackup } from "./RetroactiveBackup";


interface Config {
  ativo: boolean;
  pasta_raiz_id: string | null;
  pasta_raiz_nome: string;
}
interface LogItem {
  id: string; tipo: string; nome_arquivo: string; status: string;
  drive_url: string | null; erro_mensagem: string | null; created_at: string;
  tamanho_bytes: number | null;
}

export const DriveBackupSettings = () => {
  const [config, setConfig] = useState<Config>({ ativo: false, pasta_raiz_id: null, pasta_raiz_nome: "RH Santa Bárbara - Backup" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [account, setAccount] = useState<{ emailAddress?: string; displayName?: string } | null>(null);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [connecting, setConnecting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: cfg }, { data: lg }] = await Promise.all([
      supabase.from("drive_backup_config").select("*").eq("id", 1).maybeSingle(),
      supabase.from("drive_backup_log").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (cfg) setConfig(cfg as any);
    setLogs((lg as any) || []);
    setLoading(false);
  };

  const checkConnection = async () => {
    setChecking(true);
    const { data, error } = await supabase.functions.invoke("drive-backup-upload", { body: { action: "status" } });
    if (error || !(data as any)?.connected) {
      setConnected(false); setAccount(null);
    } else {
      setConnected(true); setAccount((data as any).account || null);
    }
    setChecking(false);
  };

  useEffect(() => {
    // Volta da tela de autorização do Google
    const params = new URLSearchParams(window.location.search);
    const resultado = params.get("drive");
    if (resultado) {
      if (resultado === "conectado") toast.success("Google Drive conectado!");
      else toast.error("Não foi possível conectar: " + (params.get("motivo") || "erro desconhecido"));
      params.delete("drive");
      params.delete("motivo");
      const query = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : "") + window.location.hash);
    }
    load();
    checkConnection();
  }, []);

  const connectDrive = async () => {
    setConnecting(true);
    const retorno = window.location.origin + window.location.pathname;
    const { data, error } = await supabase.functions.invoke("google-drive-auth", { body: { action: "init", retorno } });
    if (error || !(data as any)?.authUrl) {
      setConnecting(false);
      let msg = (data as any)?.error || error?.message || "erro desconhecido";
      try { msg = (await (error as any)?.context?.json())?.error || msg; } catch { /* mantém a mensagem */ }
      toast.error("Não foi possível iniciar a conexão: " + msg);
      return;
    }
    window.location.href = (data as any).authUrl;
  };

  const disconnectDrive = async () => {
    if (!window.confirm("Desconectar a conta Google? Os backups automáticos vão parar até conectar de novo.")) return;
    const { error } = await supabase.functions.invoke("google-drive-auth", { body: { action: "disconnect" } });
    if (error) toast.error("Erro ao desconectar: " + error.message);
    else { toast.success("Google Drive desconectado"); checkConnection(); }
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("drive_backup_config").update({
      ativo: config.ativo,
      pasta_raiz_nome: config.pasta_raiz_nome,
      pasta_raiz_id: config.pasta_raiz_id || null,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setSaving(false);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else toast.success("Configuração salva!");
  };

  const testUpload = async () => {
    setTesting(true);
    const pdfBase64 = "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nDPQM1Qo5ypUMABCBV0jvUAuIyMFcz1jBSMTQyOFkBRDPQNzhYJSAEMECwIKZW5kc3RyZWFtCmVuZG9iagozIDAgb2JqCjQyCmVuZG9iagoxIDAgb2JqCjw8L1R5cGUvUGFnZS9NZWRpYUJveFswIDAgNjEyIDc5Ml0vUmVzb3VyY2VzPDw+Pi9Db250ZW50cyAyIDAgUi9QYXJlbnQgNCAwIFI+PgplbmRvYmoKNCAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1sxIDAgUl0+PgplbmRvYmoKNSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgNCAwIFI+PgplbmRvYmoKNiAwIG9iago8PC9Qcm9kdWNlcihUZXN0KS9DcmVhdGlvbkRhdGUoRDoyMDI2KT4+CmVuZG9iagp4cmVmCjAgNwowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAxMjcgMDAwMDAgbiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMTA4IDAwMDAwIG4gCjAwMDAwMDAyMTAgMDAwMDAgbiAKMDAwMDAwMDI1NyAwMDAwMCBuIAowMDAwMDAwMjk4IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA3L1Jvb3QgNSAwIFIvSW5mbyA2IDAgUj4+CnN0YXJ0eHJlZgozNDgKJSVFT0YK";
    const { data, error } = await supabase.functions.invoke("drive-backup-upload", {
      body: {
        action: "test", tipo: "Teste",
        nome_arquivo: `teste_${Date.now()}.pdf`,
        pdf_base64: pdfBase64,
      },
    });
    setTesting(false);
    if (error || (data as any)?.error) toast.error("Falhou: " + (error?.message || (data as any)?.error));
    else { toast.success("Upload de teste OK! Confira no Drive."); load(); }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Backup Google Drive</CardTitle>
                <CardDescription>Envio automático dos PDFs gerados pelo sistema</CardDescription>
              </div>
            </div>
            {connected === null ? (
              <Badge variant="secondary">Verificando...</Badge>
            ) : connected ? (
              <Badge className="bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Conectado</Badge>
            ) : (
              <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Desconectado</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {connected && account && (
            <p className="text-sm text-muted-foreground">
              Conta vinculada: <strong>{account.displayName}</strong> ({account.emailAddress})
            </p>
          )}
          {connected === false && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
              <span>Conecte a conta Google da empresa para ativar os backups no Drive.</span>
              <Button size="sm" onClick={connectDrive} disabled={connecting}>
                {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                Conectar Google Drive
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between border rounded-lg p-4">
            <div>
              <Label className="text-base">Backup automático</Label>
              <p className="text-xs text-muted-foreground">Envia cada PDF gerado para o Drive</p>
            </div>
            <Switch checked={config.ativo} onCheckedChange={(v) => setConfig({ ...config, ativo: v })} />
          </div>

          <div className="space-y-2">
            <Label>Nome da pasta raiz no Drive</Label>
            <Input
              value={config.pasta_raiz_nome}
              onChange={(e) => setConfig({ ...config, pasta_raiz_nome: e.target.value })}
              placeholder="RH Santa Bárbara - Backup"
            />
            {config.pasta_raiz_id && (
              <p className="text-xs text-muted-foreground">ID da pasta: <code>{config.pasta_raiz_id}</code></p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
            </Button>
            <Button variant="outline" onClick={checkConnection} disabled={checking}>
              {checking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Verificar conexão
            </Button>
            <Button variant="outline" onClick={testUpload} disabled={testing || !connected}>
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Testar upload
            </Button>
            {connected && (
              <Button variant="ghost" onClick={disconnectDrive}>
                <Unlink className="h-4 w-4 mr-2" /> Desconectar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {connected && <RetroactiveBackup />}

      <Card>

        <CardHeader>
          <CardTitle className="text-base">Histórico (últimos 50)</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum upload registrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">{format(new Date(l.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell><Badge variant="outline">{l.tipo}</Badge></TableCell>
                      <TableCell className="max-w-xs truncate text-xs" title={l.nome_arquivo}>{l.nome_arquivo}</TableCell>
                      <TableCell>
                        {l.status === "sucesso" ? (
                          <Badge className="bg-emerald-500 hover:bg-emerald-600">OK</Badge>
                        ) : (
                          <Badge variant="destructive" title={l.erro_mensagem || ""}>Erro</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {l.drive_url && (
                          <a href={l.drive_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="ghost"><ExternalLink className="h-3 w-3" /></Button>
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Copy, Bell, Send, History, User, Bot, ChevronDown, ChevronUp } from "lucide-react";
import { WhatsAppContatos } from "./WhatsAppContatos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { dataBR } from "@/lib/date";

interface WhatsAppConfig {
  evolution_api_url: string;
  evolution_api_key: string;
  evolution_instance_name: string;
  whatsapp_allowed_numbers: string;
  numero_lembrete: string;
  numeros_eventos_globais: string;
  horario_lembrete: string;
  lembrete_ativo: boolean;
}

interface Conversa {
  id: string;
  phone_number: string;
  role: string;
  content: string;
  created_at: string;
}

export function WhatsAppSettings() {
  const [config, setConfig] = useState<WhatsAppConfig>({
    evolution_api_url: "",
    evolution_api_key: "",
    evolution_instance_name: "",
    whatsapp_allowed_numbers: "",
    numero_lembrete: "",
    numeros_eventos_globais: "",
    horario_lembrete: "07:00",
    lembrete_ativo: false,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingReminder, setTestingReminder] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [conversas, setConversas] = useState<Record<string, Conversa[]>>({});
  const [loadingConversas, setLoadingConversas] = useState(false);
  const [expandedNumber, setExpandedNumber] = useState<string | null>(null);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-ai`;

  useEffect(() => {
    loadConfig();
    loadConversas();
  }, []);

  const loadConfig = async () => {
    const { data } = await supabase
      .from("configuracoes_whatsapp" as any)
      .select("*")
      .limit(1)
      .maybeSingle();

    if (data) {
      const d = data as any;
      setConfig({
        evolution_api_url: d.evolution_api_url || "",
        evolution_api_key: d.evolution_api_key || "",
        evolution_instance_name: d.evolution_instance_name || "",
        whatsapp_allowed_numbers: d.whatsapp_allowed_numbers || "",
        numero_lembrete: d.numero_lembrete || "",
        numeros_eventos_globais: d.numeros_eventos_globais || "",
        horario_lembrete: d.horario_lembrete?.substring(0, 5) || "07:00",
        lembrete_ativo: d.lembrete_ativo || false,
      });
    }
    setLoaded(true);
  };

  const loadConversas = async () => {
    setLoadingConversas(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_conversas" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const grouped: Record<string, Conversa[]> = {};
      (data as any[] || []).forEach((msg: any) => {
        if (!grouped[msg.phone_number]) {
          grouped[msg.phone_number] = [];
        }
        grouped[msg.phone_number].push(msg);
      });

      // Sort messages within each number chronologically
      Object.keys(grouped).forEach((num) => {
        grouped[num].sort((a, b) => dataBR(a.created_at).getTime() - dataBR(b.created_at).getTime());
      });

      setConversas(grouped);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoadingConversas(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("configuracoes_whatsapp" as any)
        .select("id")
        .limit(1)
        .maybeSingle();

      const payload = {
        evolution_api_url: config.evolution_api_url,
        evolution_api_key: config.evolution_api_key,
        evolution_instance_name: config.evolution_instance_name,
        whatsapp_allowed_numbers: config.whatsapp_allowed_numbers,
        numero_lembrete: config.numero_lembrete,
        numeros_eventos_globais: config.numeros_eventos_globais,
        horario_lembrete: config.horario_lembrete + ":00",
        lembrete_ativo: config.lembrete_ativo,
      } as any;

      if (existing) {
        await supabase
          .from("configuracoes_whatsapp" as any)
          .update(payload)
          .eq("id", (existing as any).id);
      } else {
        await supabase.from("configuracoes_whatsapp" as any).insert(payload);
      }

      toast.success("Configurações do WhatsApp salvas com sucesso!");
    } catch (error) {
      console.error("Error saving WhatsApp config:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL do webhook copiada!");
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "messages.upsert",
          data: {
            key: { remoteJid: "test@s.whatsapp.net", fromMe: true, id: "test" },
            message: { conversation: "teste" },
          },
        }),
      });

      if (response.ok) {
        toast.success("Webhook está funcionando!");
      } else {
        toast.error("Erro ao testar webhook");
      }
    } catch {
      toast.error("Não foi possível conectar ao webhook");
    } finally {
      setTesting(false);
    }
  };

  const handleTestReminder = async () => {
    if (!config.numero_lembrete) {
      toast.error("Configure os números para lembrete primeiro");
      return;
    }
    setTestingReminder(true);
    try {
      const reminderUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-daily-reminder`;
      const response = await fetch(reminderUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        toast.success("Lembrete enviado com sucesso!");
      } else {
        const err = await response.text();
        console.error("Reminder error:", err);
        toast.error("Erro ao enviar lembrete");
      }
    } catch {
      toast.error("Não foi possível enviar o lembrete");
    } finally {
      setTestingReminder(false);
    }
  };

  const formatPhoneNumber = (num: string) => {
    if (num.length >= 12) {
      return `+${num.slice(0, 2)} (${num.slice(2, 4)}) ${num.slice(4, 9)}-${num.slice(9)}`;
    }
    return num;
  };

  if (!loaded) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Integração WhatsApp - Evolution API
          </CardTitle>
          <CardDescription>
            Configure a integração do assistente de IA com o WhatsApp via Evolution API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>URL do Webhook (configure na Evolution API)</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure este URL como webhook na sua instância da Evolution API para o evento MESSAGES_UPSERT.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="evolution_url">URL da Evolution API</Label>
            <Input
              id="evolution_url"
              placeholder="https://evolution.seudominio.com"
              value={config.evolution_api_url}
              onChange={(e) => setConfig(prev => ({ ...prev, evolution_api_url: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="evolution_key">Chave da API (apikey)</Label>
            <Input
              id="evolution_key"
              type="password"
              placeholder="Sua chave da Evolution API"
              value={config.evolution_api_key}
              onChange={(e) => setConfig(prev => ({ ...prev, evolution_api_key: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instance_name">Nome da Instância</Label>
            <Input
              id="instance_name"
              placeholder="nome-da-instancia"
              value={config.evolution_instance_name}
              onChange={(e) => setConfig(prev => ({ ...prev, evolution_instance_name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="allowed_numbers">Números Autorizados</Label>
            <Input
              id="allowed_numbers"
              placeholder="5511999999999,5511888888888"
              value={config.whatsapp_allowed_numbers}
              onChange={(e) => setConfig(prev => ({ ...prev, whatsapp_allowed_numbers: e.target.value }))}
            />
            <p className="text-sm text-muted-foreground">
              Números que podem usar o assistente, separados por vírgula (com código do país, sem +). Deixe vazio para permitir todos.
            </p>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Configurações"}
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? "Testando..." : "Testar Webhook"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Lembrete Diário Matinal
          </CardTitle>
          <CardDescription>
            Configure o envio automático de um resumo diário dos compromissos e pendências do dia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Ativar lembrete diário</Label>
              <p className="text-sm text-muted-foreground">O assistente enviará uma mensagem matinal com os compromissos do dia</p>
            </div>
            <Switch
              checked={config.lembrete_ativo}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, lembrete_ativo: checked }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="numero_lembrete">Números para receber lembrete</Label>
            <Input
              id="numero_lembrete"
              placeholder="5511999999999,5511888888888"
              value={config.numero_lembrete}
              onChange={(e) => setConfig(prev => ({ ...prev, numero_lembrete: e.target.value }))}
            />
            <p className="text-sm text-muted-foreground">
              Números que receberão o lembrete diário, separados por vírgula (com código do país, sem +). Cada número recebe apenas seus próprios compromissos agendados pelo WhatsApp.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="numeros_eventos_globais">Números que recebem eventos globais do sistema</Label>
            <Input
              id="numeros_eventos_globais"
              placeholder="5511999999999,5511888888888"
              value={config.numeros_eventos_globais}
              onChange={(e) => setConfig(prev => ({ ...prev, numeros_eventos_globais: e.target.value }))}
            />
            <p className="text-sm text-muted-foreground">
              Estes números receberão no lembrete matinal TODOS os eventos do sistema (férias, afastamentos, aniversários, pendências etc.), além dos seus compromissos pessoais. Os demais números recebem apenas seus próprios compromissos.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="horario_lembrete">Horário do lembrete</Label>
            <Input
              id="horario_lembrete"
              type="time"
              value={config.horario_lembrete}
              onChange={(e) => setConfig(prev => ({ ...prev, horario_lembrete: e.target.value }))}
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Configurações"}
            </Button>
            <Button variant="outline" onClick={handleTestReminder} disabled={testingReminder}>
              <Send className="h-4 w-4 mr-2" />
              {testingReminder ? "Enviando..." : "Enviar Lembrete Agora"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <WhatsAppContatos />

      {/* Conversation History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Conversas WhatsApp
              </CardTitle>
              <CardDescription>
                Veja o histórico de conversas do Cérebrum com cada número no WhatsApp.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadConversas} disabled={loadingConversas}>
              {loadingConversas ? "Carregando..." : "Atualizar"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(conversas).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma conversa registrada ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(conversas)
                .sort(([, a], [, b]) => {
                  const lastA = a[a.length - 1]?.created_at || "";
                  const lastB = b[b.length - 1]?.created_at || "";
                  return lastB.localeCompare(lastA);
                })
                .map(([phoneNumber, msgs]) => (
                  <div key={phoneNumber} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedNumber(expandedNumber === phoneNumber ? null : phoneNumber)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-sm">{formatPhoneNumber(phoneNumber)}</p>
                          <p className="text-xs text-muted-foreground">
                            {msgs.length} mensagens · Última: {format(dataBR(msgs[msgs.length - 1].created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{msgs.length}</Badge>
                        {expandedNumber === phoneNumber ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {expandedNumber === phoneNumber && (
                      <div className="max-h-[600px] overflow-y-auto border-t">
                        <div className="p-3 space-y-2">
                          {msgs.map((msg) => (
                            <div
                              key={msg.id}
                              className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                              {msg.role === "assistant" && (
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                                  <Bot className="h-3 w-3 text-primary" />
                                </div>
                              )}
                              <div
                                className={`max-w-[75%] rounded-lg px-3 py-2 text-xs ${
                                  msg.role === "user"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                  {format(dataBR(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                              {msg.role === "user" && (
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center mt-1">
                                  <User className="h-3 w-3 text-primary-foreground" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Como Configurar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">1</Badge>
              <p className="text-sm">Tenha uma instância da Evolution API rodando com um número de WhatsApp conectado.</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">2</Badge>
              <p className="text-sm">Preencha os campos acima com os dados da sua instância e salve.</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">3</Badge>
              <p className="text-sm">Configure o webhook na Evolution API apontando para a URL acima, com o evento <code className="bg-muted px-1 rounded">MESSAGES_UPSERT</code>.</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">4</Badge>
              <p className="text-sm">Envie uma mensagem para o número do WhatsApp e o assistente responderá automaticamente!</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">5</Badge>
              <p className="text-sm">Para lembretes diários, ative o lembrete, informe os números (separados por vírgula) e o horário desejado.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

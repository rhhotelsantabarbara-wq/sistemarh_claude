import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Brain, Eye, EyeOff, Save } from "lucide-react";

export function AISettings() {
  const [provedor, setProvedor] = useState("gemini");
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [modelo, setModelo] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  const defaultModels: Record<string, string> = {
    gemini: "gemini-2.5-flash",
    openai: "gpt-4o-mini",
    ollama: "llama3.1",
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const { data } = await supabase
      .from("configuracoes_ia")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (data) {
      setConfigId(data.id);
      setGeminiKey(data.google_gemini_api_key || "");
      setOpenaiKey((data as any).openai_api_key || "");
      setProvedor((data as any).provedor || "gemini");
      setModelo(data.modelo || "");
    }
  };

  const handleProvedorChange = (value: string) => {
    setProvedor(value);
    setModelo(defaultModels[value] || "");
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload = {
        google_gemini_api_key: geminiKey,
        openai_api_key: openaiKey,
        modelo: modelo || defaultModels[provedor],
        provedor,
      };

      if (configId) {
        const { error } = await supabase
          .from("configuracoes_ia")
          .update(payload as any)
          .eq("id", configId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("configuracoes_ia")
          .insert(payload as any)
          .select()
          .single();
        if (error) throw error;
        setConfigId(data.id);
      }

      toast.success("Configurações de IA salvas com sucesso!");
    } catch (error) {
      console.error("Error saving AI config:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setLoading(false);
    }
  };

  const maskKey = (key: string) =>
    key ? key.substring(0, 6) + "•".repeat(Math.max(0, key.length - 10)) + key.substring(key.length - 4) : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          Configurações de IA
        </CardTitle>
        <CardDescription>
          Configure o provedor e a chave de API para as funcionalidades de inteligência artificial.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Provedor de IA</Label>
          <Select value={provedor} onValueChange={handleProvedorChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="gemini">Google Gemini</SelectItem>
              <SelectItem value="ollama">Ollama (VPS)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {provedor === "openai" && (
          <div className="space-y-2">
            <Label htmlFor="openai-key">Chave de API da OpenAI</Label>
            <div className="relative">
              <Input
                id="openai-key"
                type={showOpenaiKey ? "text" : "password"}
                value={showOpenaiKey ? openaiKey : maskKey(openaiKey)}
                onChange={(e) => {
                  setShowOpenaiKey(true);
                  setOpenaiKey(e.target.value);
                }}
                placeholder="sk-..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowOpenaiKey(!showOpenaiKey)}
              >
                {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Obtenha sua chave em{" "}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                platform.openai.com/api-keys
              </a>
            </p>
          </div>
        )}

        {provedor === "gemini" && (
          <div className="space-y-2">
            <Label htmlFor="gemini-key">Chave de API do Google Gemini</Label>
            <div className="relative">
              <Input
                id="gemini-key"
                type={showGeminiKey ? "text" : "password"}
                value={showGeminiKey ? geminiKey : maskKey(geminiKey)}
                onChange={(e) => {
                  setShowGeminiKey(true);
                  setGeminiKey(e.target.value);
                }}
                placeholder="AIzaSy..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
              >
                {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Obtenha sua chave gratuita em{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                aistudio.google.com/apikey
              </a>
            </p>
          </div>
        )}

        {provedor === "ollama" && (
          <p className="text-sm text-muted-foreground">
            O Ollama utiliza a variável de ambiente <code className="bg-muted px-1 rounded">OLLAMA_BASE_URL</code> configurada no servidor.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="modelo">Modelo</Label>
          <Input
            id="modelo"
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            placeholder={defaultModels[provedor]}
          />
          <p className="text-xs text-muted-foreground">
            {provedor === "openai" && "Modelos: gpt-4o-mini, gpt-4o, gpt-4-turbo, gpt-3.5-turbo"}
            {provedor === "gemini" && "Modelos: gemini-2.5-flash (recomendado, gratuito), gemini-2.5-pro (mais inteligente, mais lento)"}
            {provedor === "ollama" && "Modelos: llama3.1, mistral, codellama, etc."}
          </p>
        </div>

        <Button onClick={handleSave} disabled={loading}>
          <Save className="w-4 h-4 mr-2" />
          {loading ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </CardContent>
    </Card>
  );
}

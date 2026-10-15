import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Link2, Unlink, RefreshCw, Download, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";

interface GoogleCalendarSettingsProps {
  onRefresh?: () => void;
}

export const GoogleCalendarSettings = ({ onRefresh }: GoogleCalendarSettingsProps) => {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStart, setImportStart] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [importEnd, setImportEnd] = useState(format(endOfMonth(addMonths(new Date(), 1)), "yyyy-MM-dd"));

  useEffect(() => {
    // Volta da tela de autorização do Google
    const params = new URLSearchParams(window.location.search);
    const resultado = params.get("google_calendar");
    if (resultado) {
      if (resultado === "conectado") toast.success("Google Agenda conectado!");
      else toast.error("Não foi possível conectar: " + (params.get("motivo") || "erro desconhecido"));
      ["google_calendar", "motivo", "google_callback"].forEach((p) => params.delete(p));
      const query = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : "") + window.location.hash);
    }
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke("google-calendar-auth", {
        body: {},
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });

      // Use URL params for action
      const statusResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth?action=status`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await statusResponse.json();
      setConnected(data.connected);
    } catch (error) {
      console.error("Error checking status:", error);
    } finally {
      setChecking(false);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const redirectUri = `${window.location.origin}/eventos?google_callback=true`;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth?action=init`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ redirectUri }),
        }
      );

      const data = await response.json();
      
      if (data.authUrl) {
        // Store the redirect URI in sessionStorage for the callback
        sessionStorage.setItem("google_redirect_uri", redirectUri);
        window.location.href = data.authUrl;
      } else {
        toast.error("Erro ao iniciar conexão com Google");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao conectar com Google Calendar");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Deseja desconectar do Google Calendar?")) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth?action=disconnect`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();
      
      if (data.success) {
        setConnected(false);
        toast.success("Desconectado do Google Calendar");
      } else {
        toast.error(data.error || "Erro ao desconectar");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao desconectar");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync?action=import`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            timeMin: new Date(importStart).toISOString(),
            timeMax: new Date(importEnd + "T23:59:59").toISOString(),
          }),
        }
      );

      const data = await response.json();
      
      if (data.success) {
        toast.success(`Importados ${data.imported} eventos (${data.skipped} já existiam)`);
        setImportDialogOpen(false);
        onRefresh?.();
      } else {
        toast.error(data.error || "Erro ao importar eventos");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao importar eventos");
    } finally {
      setImporting(false);
    }
  };

  if (checking) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <CardTitle className="text-lg">Google Calendar</CardTitle>
          </div>
          <Badge variant={connected ? "default" : "secondary"}>
            {connected ? "Conectado" : "Desconectado"}
          </Badge>
        </div>
        <CardDescription>
          Sincronize seus eventos com o Google Calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected ? (
          <div className="flex flex-wrap gap-2">
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Importar do Google
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Importar Eventos do Google Calendar</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Data Inicial</Label>
                      <Input
                        type="date"
                        value={importStart}
                        onChange={(e) => setImportStart(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Data Final</Label>
                      <Input
                        type="date"
                        value={importEnd}
                        onChange={(e) => setImportEnd(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Os eventos do Google Calendar serão importados para o sistema. Eventos já existentes serão ignorados.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleImport} disabled={importing}>
                    {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Importar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm" onClick={checkStatus}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Verificar Status
            </Button>

            <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Unlink className="h-4 w-4 mr-2" />}
              Desconectar
            </Button>
          </div>
        ) : (
          <Button onClick={handleConnect} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
            Conectar ao Google Calendar
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

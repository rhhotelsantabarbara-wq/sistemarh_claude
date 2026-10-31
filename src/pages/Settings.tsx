import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { SiteSettings } from "@/components/settings/SiteSettings";
import { DashboardVisibilitySettings } from "@/components/settings/DashboardVisibilitySettings";
import { ExperienceAlertSettings } from "@/components/settings/ExperienceAlertSettings";
import { DatabaseBackupSettings } from "@/components/settings/DatabaseBackupSettings";
import { DriveBackupSettings } from "@/components/settings/DriveBackupSettings";
import { WhatsAppSettings } from "@/components/settings/WhatsAppSettings";
import { AISettings } from "@/components/settings/AISettings";
import PageHeader from "@/components/layout/PageHeader";
import { Settings as SettingsIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Settings = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if user is a manager
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (userRole?.role !== "gestor") {
        navigate("/dashboard");
      }
    };

    checkAuth();
  }, [navigate]);

  return (
    <div className="">
      <div>
        <div>
          <div className="mb-6">
            <PageHeader titulo="Configurações" descricao="Site, painel do colaborador, alertas, backup, Google Drive, WhatsApp e inteligência artificial" icone={SettingsIcon} />
          </div>

          <Tabs defaultValue={new URLSearchParams(window.location.search).has("drive") ? "drive" : "site"} className="space-y-6">
            <TabsList className="flex-wrap">
              <TabsTrigger value="site">Site</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard Funcionário</TabsTrigger>
              <TabsTrigger value="alertas">Alertas</TabsTrigger>
              <TabsTrigger value="backup">Backup</TabsTrigger>
              <TabsTrigger value="drive">Google Drive</TabsTrigger>
              <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
              <TabsTrigger value="ia">Inteligência Artificial</TabsTrigger>
            </TabsList>
            
            <TabsContent value="site">
              <SiteSettings />
            </TabsContent>

            <TabsContent value="drive">
              <DriveBackupSettings />
            </TabsContent>
            
            <TabsContent value="dashboard">
              <DashboardVisibilitySettings />
            </TabsContent>
            
            <TabsContent value="alertas">
              <ExperienceAlertSettings />
            </TabsContent>

            <TabsContent value="backup">
              <DatabaseBackupSettings />
            </TabsContent>

            <TabsContent value="whatsapp">
              <WhatsAppSettings />
            </TabsContent>

            <TabsContent value="ia">
              <AISettings />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Settings;

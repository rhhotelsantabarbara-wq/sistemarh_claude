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
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="p-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          
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

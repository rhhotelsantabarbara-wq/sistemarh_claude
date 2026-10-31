import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import ManagerList from "@/components/managers/ManagerList";
import { Loader2, LogOut, Shield, ArrowLeft } from "lucide-react";

export default function Managers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isGestor, setIsGestor] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (roles?.role !== "gestor") {
        navigate("/dashboard");
        return;
      }

      setIsGestor(true);
    } catch (error) {
      console.error("Erro ao verificar autenticação:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isGestor) {
    return null;
  }

  return (
    <div className="">
      <div className="mb-6">
        <PageHeader titulo="Gestores" descricao="Quem tem acesso total ao sistema" icone={Shield} />
      </div>

      <div className="space-y-6">
        
        <ManagerList />
      </div>
    </div>
  );
}

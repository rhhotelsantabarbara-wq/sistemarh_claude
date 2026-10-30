import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import FuncionarioDashboard from "@/components/dashboard/FuncionarioDashboard";
import { Button } from "@/components/ui/button";
import { Eye, X } from "lucide-react";

/** RH vendo o portal de um colaborador, sem trocar de login */
const VerComoColaborador = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [permitido, setPermitido] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/auth");
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setPermitido((data || []).some((r: any) => r.role === "gestor" || r.role === "admin_parcial"));
    })();
  }, [navigate]);

  if (permitido === null) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  if (!permitido) return <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">Somente o RH pode ver o painel de outro colaborador.</div>;

  return (
    <div>
      <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950">
        <span className="flex min-w-0 items-center gap-2"><Eye className="h-4 w-4 shrink-0" /><span className="truncate">Visualização do RH: você está vendo o painel como o colaborador vê</span></span>
        <Button size="sm" variant="ghost" className="h-7 shrink-0 text-amber-950 hover:bg-amber-300" onClick={() => navigate("/dashboard#funcionarios")}><X className="mr-1 h-4 w-4" />Sair</Button>
      </div>
      <FuncionarioDashboard key={id} previewEmployeeId={id} />
    </div>
  );
};

export default VerComoColaborador;

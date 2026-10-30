import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";
import { User, Session } from "@supabase/supabase-js";
import { Eye, EyeOff } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [verSenha, setVerSenha] = useState(false);

  useEffect(() => {
    const fetchCompanyLogo = async () => {
      const { data } = await supabase
        .from("empresas")
        .select("logo_url")
        .limit(1)
        .maybeSingle();
      
      if (data?.logo_url) {
        setCompanyLogo(data.logo_url);
      }
    };

    fetchCompanyLogo();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        navigate("/dashboard");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cpfLimpo = cpf.replace(/\D/g, '')
      const prefixes = ["funcionario", "gestor", "admin"];
      let data: any = null;
      let lastError: any = null;

      for (const prefix of prefixes) {
        const email = `${prefix}.${cpfLimpo}@rhsantabarbara.app`;
        const { data: d, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) { data = d; break; }
        lastError = error;
      }

      if (!data) {
        toast.error("Erro ao fazer login", {
          description: "CPF ou senha incorretos. Verifique se o usuário foi cadastrado no sistema.",
        });
        return;
      }

      if (data.user) {
        const { data: employeeData } = await supabase
          .from("employees")
          .select("id")
          .eq("user_id", data.user.id)
          .maybeSingle();

        await supabase.from("login_history").insert({
          user_id: data.user.id,
          employee_id: employeeData?.id,
          ip_address: null,
          user_agent: navigator.userAgent,
        });
      }

      toast.success("Login realizado com sucesso!");
    } catch (error: any) {
      toast.error("Erro inesperado", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatarCpf = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px]">
          <div className="rounded-xl bg-card px-6 py-8 shadow-[0_1px_2px_rgba(20,24,40,0.06),0_8px_24px_rgba(20,24,40,0.06)] sm:px-9 sm:py-10">
            <div className="mb-8 flex flex-col items-center text-center">
              <img src={companyLogo || "/favicon.png"} alt="Hotel Fazenda Santa Bárbara" className="h-20 w-auto object-contain" />
              <div className="mt-5 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">C</span>
                <span className="text-lg font-medium">Cérebrum</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Entre com seu CPF e senha</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cpf" className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">CPF</Label>
                <Input
                  id="cpf"
                  type="text"
                  inputMode="numeric"
                  autoComplete="username"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatarCpf(e.target.value))}
                  required
                  className="h-11 rounded-lg border-0 bg-muted text-base sm:text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={verSenha ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 rounded-lg border-0 bg-muted pr-11 text-base sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setVerSenha(!verSenha)}
                    aria-label={verSenha ? "Esconder senha" : "Mostrar senha"}
                    className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                  >
                    {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="mt-2 h-11 w-full text-[12px] font-bold uppercase tracking-[0.05em]" disabled={loading}>
                {loading ? "Entrando…" : "Entrar"}
              </Button>
            </form>
            <p className="mt-6 text-center text-xs text-muted-foreground">Esqueceu a senha? Fale com o RH.</p>
          </div>
        </div>
      </main>
      <footer className="pb-6 text-center text-xs text-muted-foreground">
        Hotel Fazenda Santa Bárbara · RH © {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default Auth;

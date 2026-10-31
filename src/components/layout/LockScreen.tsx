import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2, ArrowRight, Fingerprint } from "lucide-react";
import { toast } from "sonner";

interface LockScreenProps {
  userEmail: string;
  onUnlock: () => void;
}

export default function LockScreen({ userEmail, onUnlock }: LockScreenProps) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(new Date());
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });
      if (error) {
        toast.error("Senha incorreta");
        setPassword("");
        setShake(true);
        setTimeout(() => setShake(false), 500);
      } else {
        onUnlock();
      }
    } catch {
      toast.error("Erro ao verificar senha");
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const hours = time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const seconds = time.toLocaleTimeString("pt-BR", { second: "2-digit" });
  const dateStr = time.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const initials = userEmail.slice(0, 2).toUpperCase();
  const greeting = (() => {
    const h = time.getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-background animate-in fade-in duration-300">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className={`w-full max-w-[400px] transition-transform ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""}`}>
          <div className="rounded-xl bg-card px-6 py-8 text-center shadow-[0_1px_2px_rgba(20,24,40,0.06),0_8px_24px_rgba(20,24,40,0.06)] sm:px-9">
            <p className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Sessão bloqueada
            </p>
            <p className="mt-4 text-5xl font-medium tabular-nums">{hours}</p>
            <p className="mt-1 text-sm capitalize text-muted-foreground">{dateStr}</p>

            <div className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">{initials}</div>
            <p className="mt-3 text-base font-medium">{greeting}</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>

            <form onSubmit={handleUnlock} className="mt-6 space-y-3 text-left">
              <label htmlFor="senha-desbloqueio" className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">Senha</label>
              <div className="relative">
                <Fingerprint className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="senha-desbloqueio"
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  disabled={loading}
                  className="h-11 w-full rounded-lg border-0 bg-muted pl-10 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
                />
              </div>
              <Button type="submit" disabled={loading || !password.trim()} className="h-11 w-full text-[12px] font-bold uppercase tracking-[0.05em]">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Desbloquear
              </Button>
            </form>

            <button
              type="button"
              onClick={handleSwitchAccount}
              className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              Entrar com outra conta
            </button>
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">Hotel Fazenda Santa Bárbara · RH</p>
        </div>
      </main>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}

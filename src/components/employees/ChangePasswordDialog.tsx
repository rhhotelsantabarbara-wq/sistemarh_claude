import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Key, Loader2 } from "lucide-react";

interface ChangePasswordDialogProps {
  userId: string | null | undefined;
  employeeName: string;
  /** para criar o acesso de quem ainda não tem login */
  employeeId?: string;
  cpf?: string | null;
  onUpdate?: () => void;
}

const ChangePasswordDialog = ({ userId, employeeName, employeeId, cpf, onUpdate }: ChangePasswordDialogProps) => {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId && !(employeeId && cpf)) {
      toast.error("Cadastre o CPF do funcionário antes de criar o acesso");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);

    try {
      if (!userId) {
        // Ainda não tem login: cria o acesso com o CPF e liga ao cadastro
        const { data, error } = await supabase.functions.invoke('create-employee-user', {
          body: { cpf, senha: newPassword, nome_completo: employeeName }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const { error: vinculoError } = await supabase.from("employees").update({ user_id: data.user.id }).eq("id", employeeId!);
        if (vinculoError) throw vinculoError;
        toast.success("Acesso criado. Entra com o CPF e esta senha.");
        onUpdate?.();
      } else {
        const { data, error } = await supabase.functions.invoke('update-employee-password', {
          body: { userId, newPassword }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success(data?.emailCorrigido ? "Senha alterada e login ajustado ao CPF atual" : "Senha alterada com sucesso");
      }
      setNewPassword("");
      setConfirmPassword("");
      setOpen(false);
    } catch (error: any) {
      console.error("Erro ao alterar senha:", error);
      toast.error(error.message || "Erro ao alterar senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Key className="w-4 h-4 mr-2" />
          {userId ? "Alterar Senha" : "Criar acesso"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{userId ? "Alterar senha" : "Criar acesso"} - {employeeName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova Senha</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Digite a senha novamente"
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Alterar Senha
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;

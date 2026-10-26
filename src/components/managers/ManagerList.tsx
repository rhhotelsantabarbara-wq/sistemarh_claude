import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, UserCog, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ManagerForm from "./ManagerForm";
import EditManagerDialog from "./EditManagerDialog";
import { toast } from "sonner";

interface Manager {
  user_id: string;
  profiles: {
    nome_completo: string;
    email: string;
  } | null;
}

export default function ManagerList() {
  const [showForm, setShowForm] = useState(false);
  const [editingManager, setEditingManager] = useState<Manager | null>(null);
  const [deletingManager, setDeletingManager] = useState<Manager | null>(null);

  const { data: managers, isLoading, refetch } = useQuery({
    queryKey: ["managers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          profiles:user_id (
            nome_completo,
            email
          )
        `)
        .eq("role", "gestor");

      if (error) throw error;
      return data as Manager[];
    },
  });

  const handleDelete = async () => {
    if (!deletingManager) return;

    try {
      const { error } = await supabase.functions.invoke('delete-user', {
        body: {
          user_id: deletingManager.user_id,
        }
      });

      if (error) throw error;

      toast.success("Gestor excluído com sucesso!");
      refetch();
    } catch (error: any) {
      console.error("Erro ao excluir gestor:", error);
      toast.error(error.message || "Erro ao excluir gestor");
    } finally {
      setDeletingManager(null);
    }
  };

  if (showForm) {
    return (
      <ManagerForm
        onSaved={() => {
          setShowForm(false);
          refetch();
        }}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestores</h2>
        <Button onClick={() => setShowForm(true)}>
          <UserCog className="mr-2 h-4 w-4" />
          Novo Gestor
        </Button>
      </div>

      <div className="grid gap-4">
        {managers?.map((manager) => (
          <Card key={manager.user_id}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">
                    {manager.profiles?.nome_completo}
                  </h3>
                  <p className="text-sm text-muted-foreground break-all">
                    {manager.profiles?.email}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Gestor</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingManager(manager)}
                    aria-label="Editar gestor"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeletingManager(manager)}
                    aria-label="Excluir gestor"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <EditManagerDialog
        manager={editingManager}
        open={!!editingManager}
        onOpenChange={(open) => !open && setEditingManager(null)}
        onSuccess={refetch}
      />

      <AlertDialog open={!!deletingManager} onOpenChange={(open) => !open && setDeletingManager(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o gestor{" "}
              <strong>{deletingManager?.profiles?.nome_completo}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

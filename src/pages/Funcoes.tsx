import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import FuncaoForm from "@/components/funcoes/FuncaoForm";
import FuncaoList from "@/components/funcoes/FuncaoList";

const Funcoes = () => {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFuncaoId, setEditingFuncaoId] = useState<string | undefined>();

  const { data: funcoes, isLoading, refetch } = useQuery({
    queryKey: ["funcoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcoes")
        .select("*")
        .order("nome");
      
      if (error) throw error;
      return data;
    },
  });

  const handleEdit = (id: string) => {
    setEditingFuncaoId(id);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingFuncaoId(undefined);
  };

  const handleSaved = () => {
    refetch();
    handleCloseDialog();
  };

  return (
    <div className="container mx-auto p-0 sm:p-2 lg:p-4 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-medium leading-tight">Funções</h1>
          <p className="text-muted-foreground">Gerencie as funções e seus CBOs</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Função
        </Button>
      </div>

      <Card className="p-6">
        <FuncaoList
          funcoes={funcoes || []}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDeleted={refetch}
        />
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFuncaoId ? "Editar Função" : "Nova Função"}
            </DialogTitle>
          </DialogHeader>
          <FuncaoForm
            funcaoId={editingFuncaoId}
            onSaved={handleSaved}
            onCancel={handleCloseDialog}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Funcoes;

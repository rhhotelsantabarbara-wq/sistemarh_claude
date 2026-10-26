import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Bell, Eye, Paperclip, AlertTriangle, Megaphone, Calendar, FileText, Info, Users } from "lucide-react";
import { toast } from "sonner";
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
import EditAvisoDialog from "./EditAvisoDialog";
import AvisoLeiturasDialog from "./AvisoLeiturasDialog";
import { dataBR } from "@/lib/date";

interface ManageAvisosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const prioridadeConfig: Record<string, { label: string; color: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  baixa: { label: "Baixa", color: "bg-green-500", variant: "secondary" },
  media: { label: "Média", color: "bg-yellow-500", variant: "outline" },
  alta: { label: "Alta", color: "bg-orange-500", variant: "default" },
  urgente: { label: "Urgente", color: "bg-red-500", variant: "destructive" },
};

const categoriaIcons: Record<string, any> = {
  comunicado: Megaphone,
  lembrete: Calendar,
  alerta: AlertTriangle,
  evento: Calendar,
  rh: FileText,
  info: Info,
};

const ManageAvisosDialog = ({ open, onOpenChange }: ManageAvisosDialogProps) => {
  const [avisos, setAvisos] = useState<any[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editAviso, setEditAviso] = useState<any | null>(null);
  const [viewLeiturasAviso, setViewLeiturasAviso] = useState<any | null>(null);
  const [leiturasCount, setLeiturasCount] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open) {
      fetchAvisos();
    }
  }, [open]);

  const fetchAvisos = async () => {
    try {
      const { data, error } = await supabase
        .from("avisos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAvisos(data || []);

      // Fetch leituras count for each aviso
      if (data && data.length > 0) {
        const counts: Record<string, number> = {};
        for (const aviso of data) {
          const { count } = await supabase
            .from("avisos_leituras")
            .select("*", { count: "exact", head: true })
            .eq("aviso_id", aviso.id);
          counts[aviso.id] = count || 0;
        }
        setLeiturasCount(counts);
      }
    } catch (error) {
      console.error("Error fetching avisos:", error);
      toast.error("Erro ao carregar avisos");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase.from("avisos").delete().eq("id", deleteId);

      if (error) throw error;

      toast.success("Aviso excluído com sucesso!");
      setDeleteId(null);
      fetchAvisos();
    } catch (error) {
      console.error("Error deleting aviso:", error);
      toast.error("Erro ao excluir aviso");
    }
  };

  const isExpired = (dataExpiracao: string) => {
    return dataBR(dataExpiracao) < new Date();
  };

  const isScheduled = (dataPublicacao: string | null) => {
    if (!dataPublicacao) return false;
    return dataBR(dataPublicacao) > new Date();
  };

  const getDestinatarioLabel = (aviso: any) => {
    switch (aviso.tipo_destinatario) {
      case "todos":
        return "Todos os funcionários";
      case "setor":
        return `Setores: ${aviso.setores?.join(", ") || "-"}`;
      case "empresa":
        return "Empresa específica";
      case "funcionario":
        return `${aviso.funcionarios_ids?.length || 0} funcionário(s)`;
      default:
        return aviso.setores?.join(", ") || "-";
    }
  };

  const CategoriaIcon = (categoria: string) => {
    const Icon = categoriaIcons[categoria] || Bell;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Gerenciar Avisos
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {avisos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum aviso cadastrado
              </p>
            ) : (
              avisos.map((aviso) => {
                const prioridade = prioridadeConfig[aviso.prioridade] || prioridadeConfig.media;
                const expired = isExpired(aviso.data_expiracao);
                const scheduled = isScheduled(aviso.data_publicacao);

                return (
                  <Card 
                    key={aviso.id} 
                    className={`${expired ? "opacity-60" : ""} ${
                      aviso.prioridade === "urgente" ? "border-destructive" : ""
                    }`}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-base">
                        <div className="flex items-center gap-2 flex-wrap">
                          {CategoriaIcon(aviso.categoria)}
                          <span className="capitalize">{aviso.categoria || "Aviso"}</span>
                          
                          <Badge variant={prioridade.variant}>
                            <div className={`w-2 h-2 rounded-full ${prioridade.color} mr-1`} />
                            {prioridade.label}
                          </Badge>
                          
                          {expired ? (
                            <Badge variant="secondary">Expirado</Badge>
                          ) : scheduled ? (
                            <Badge variant="outline">Programado</Badge>
                          ) : (
                            <Badge variant="default">Ativo</Badge>
                          )}

                          {aviso.anexo_url && (
                            <Badge variant="outline">
                              <Paperclip className="w-3 h-3 mr-1" />
                              Anexo
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewLeiturasAviso(aviso)}
                            title="Ver leituras"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="ml-1">{leiturasCount[aviso.id] || 0}</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditAviso(aviso)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteId(aviso.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm mb-3">{aviso.mensagem}</p>
                      
                      <div className="flex flex-wrap gap-2 mb-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {getDestinatarioLabel(aviso)}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        {aviso.data_publicacao && (
                          <span>
                            Publicação: {dataBR(aviso.data_publicacao).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        <span>
                          Válido até: {dataBR(aviso.data_expiracao).toLocaleDateString("pt-BR")}
                        </span>
                        <span>
                          Criado em: {dataBR(aviso.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este aviso? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <EditAvisoDialog
        aviso={editAviso}
        open={!!editAviso}
        onOpenChange={(open) => !open && setEditAviso(null)}
        onSuccess={() => {
          setEditAviso(null);
          fetchAvisos();
        }}
      />

      {/* Leituras Dialog */}
      <AvisoLeiturasDialog
        aviso={viewLeiturasAviso}
        open={!!viewLeiturasAviso}
        onOpenChange={(open) => !open && setViewLeiturasAviso(null)}
      />
    </>
  );
};

export default ManageAvisosDialog;

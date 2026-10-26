import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Eye, Trash2, Filter, Printer, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import TacDetailsDialog from "./TacDetailsDialog";
import { generateTacPDF } from "@/lib/pdfGeneratorTac";
import { dataBR } from "@/lib/date";

const tipoLabels: Record<string, string> = {
  advertencia_verbal: "Advertência Verbal",
  advertencia_escrita: "Advertência Escrita",
  suspensao: "Suspensão",
  compromisso: "Termo de Compromisso",
};

const statusColors: Record<string, string> = {
  pendente: "bg-warning text-warning-foreground",
  visualizado: "bg-primary text-primary-foreground",
  confirmado: "bg-secondary text-secondary-foreground",
  aplicada: "bg-green-600 text-white",
};

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  visualizado: "Visualizado",
  confirmado: "Confirmado",
  aplicada: "Aplicada",
};

const TacList = () => {
  const [tacs, setTacs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [selectedTac, setSelectedTac] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [tacToDelete, setTacToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchTacs();
  }, []);

  const fetchTacs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tacs")
      .select(`
        *,
        employees (
          id,
          nome_completo,
          cargo,
          setor,
          empresas (nome)
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching TACs:", error);
      toast.error("Erro ao carregar TACs");
    } else {
      setTacs(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!tacToDelete) return;

    const { error } = await supabase
      .from("tacs")
      .delete()
      .eq("id", tacToDelete);

    if (error) {
      toast.error("Erro ao excluir TAC");
    } else {
      toast.success("TAC excluído com sucesso");
      fetchTacs();
    }

    setShowDeleteDialog(false);
    setTacToDelete(null);
  };

  const handleMarkAsApplied = async (tacId: string) => {
    const { error } = await supabase
      .from("tacs")
      .update({ status: "aplicada" as any })
      .eq("id", tacId);

    if (error) {
      toast.error("Erro ao marcar TAC como aplicada");
    } else {
      toast.success("TAC marcada como aplicada");
      fetchTacs();
    }
  };

  const filteredTacs = tacs.filter((tac) => {
    const matchesSearch =
      tac.employees?.nome_completo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tac.titulo?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || tac.status === statusFilter;
    const matchesTipo = tipoFilter === "all" || tac.tipo === tipoFilter;
    return matchesSearch && matchesStatus && matchesTipo;
  });

  // Statistics
  const stats = {
    total: tacs.length,
    pendentes: tacs.filter((t) => t.status === "pendente").length,
    visualizados: tacs.filter((t) => t.status === "visualizado").length,
    confirmados: tacs.filter((t) => t.status === "confirmado").length,
    aplicadas: tacs.filter((t) => t.status === "aplicada").length,
  };

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total de TACs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">{stats.pendentes}</div>
            <p className="text-sm text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{stats.visualizados}</div>
            <p className="text-sm text-muted-foreground">Visualizados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.aplicadas}</div>
            <p className="text-sm text-muted-foreground">Aplicadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-secondary">{stats.confirmados}</div>
            <p className="text-sm text-muted-foreground">Confirmados</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por funcionário ou título..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="visualizado">Visualizado</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="aplicada">Aplicada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(tipoLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de TACs ({filteredTacs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : filteredTacs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum TAC encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data Ocorrência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Publicado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTacs.map((tac) => (
                    <TableRow key={tac.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{tac.employees?.nome_completo}</p>
                          <p className="text-sm text-muted-foreground">
                            {tac.employees?.cargo}
                            {tac.employees?.empresas?.nome && ` - ${tac.employees.empresas.nome}`}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{tac.titulo}</TableCell>
                      <TableCell>{tipoLabels[tac.tipo] || tac.tipo}</TableCell>
                      <TableCell>
                        {dataBR(tac.data_ocorrencia).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[tac.status]}>
                          {statusLabels[tac.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {dataBR(tac.data_publicacao).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedTac(tac);
                              setShowDetailsDialog(true);
                            }}
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => generateTacPDF(tac)}
                            title="Imprimir TAC"
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                          {tac.status !== "aplicada" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleMarkAsApplied(tac.id)}
                              title="Marcar como aplicada"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setTacToDelete(tac.id);
                              setShowDeleteDialog(true);
                            }}
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <TacDetailsDialog
        tac={selectedTac}
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este TAC? Esta ação não pode ser desfeita.
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
};

export default TacList;

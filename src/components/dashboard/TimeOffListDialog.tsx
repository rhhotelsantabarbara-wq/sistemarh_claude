import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import EditTimeOffDialog from "./EditTimeOffDialog";
import jsPDF from "jspdf";
import { dataBR } from "@/lib/date";

interface TimeOffListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EmployeeTimeOff {
  id: string;
  nome_completo: string;
  cargo: string;
  setor: string | null;
  tipo_contrato: string | null;
  quantidade_folgas: number;
  ultima_alteracao_folgas: string | null;
}

interface Setor {
  id: string;
  nome: string;
}

const TimeOffListDialog = ({ open, onOpenChange }: TimeOffListDialogProps) => {
  const [employees, setEmployees] = useState<EmployeeTimeOff[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeTimeOff[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [selectedSetor, setSelectedSetor] = useState<string>("todos");
  const [selectedTipoContrato, setSelectedTipoContrato] = useState<string>("todos");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchEmployeeTimeOff();
      fetchSetores();
    }
  }, [open]);

  useEffect(() => {
    let filtered = employees;
    
    if (selectedSetor !== "todos") {
      filtered = filtered.filter(emp => emp.setor === selectedSetor);
    }
    
    if (selectedTipoContrato !== "todos") {
      filtered = filtered.filter(emp => emp.tipo_contrato === selectedTipoContrato);
    }
    
    setFilteredEmployees(filtered);
  }, [selectedSetor, selectedTipoContrato, employees]);

  const fetchEmployeeTimeOff = async () => {
    setLoading(true);
    try {
      const { data: employeesData, error: employeesError } = await supabase
        .from("employees")
        .select("id, nome_completo, cargo, setor, tipo_contrato, quantidade_folgas, ultima_alteracao_folgas")
        .in("status", ["ativo", "ferias"])
        .order("nome_completo");

      if (employeesError) throw employeesError;

      setEmployees(employeesData || []);
    } catch (error) {
      console.error("Erro ao buscar folgas:", error);
      toast.error("Erro ao carregar dados de folgas");
    } finally {
      setLoading(false);
    }
  };

  const fetchSetores = async () => {
    const { data } = await supabase.from("setores").select("*").order("nome");
    if (data) setSetores(data);
  };

  const handleExportPDF = () => {
    if (filteredEmployees.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Hotel Fazenda Santa Bárbara", pageWidth / 2, yPosition, { align: "center" });
    
    yPosition += 10;
    doc.setFontSize(12);
    doc.text("FOLGAS NA CASA - RELATÓRIO DE FUNCIONÁRIOS", pageWidth / 2, yPosition, { align: "center" });
    
    yPosition += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const currentDate = new Date().toLocaleDateString("pt-BR");
    doc.text(`Data: ${currentDate}`, pageWidth / 2, yPosition, { align: "center" });
    
    yPosition += 5;
    const setorName = selectedSetor === "todos" ? "Todos os Setores" : setores.find(s => s.nome === selectedSetor)?.nome || selectedSetor;
    doc.text(`Setor: ${setorName}`, pageWidth / 2, yPosition, { align: "center" });
    
    yPosition += 5;
    const tipoContratoLabels: Record<string, string> = {
      fixo: "Fixo",
      intermitente: "Intermitente",
      prestador_servico: "Prestador de Serviço"
    };
    const tipoContratoName = selectedTipoContrato === "todos" ? "Todos os Contratos" : tipoContratoLabels[selectedTipoContrato] || selectedTipoContrato;
    doc.text(`Tipo de Contrato: ${tipoContratoName}`, pageWidth / 2, yPosition, { align: "center" });
    
    yPosition += 15;

    // Table header
    doc.setFont("helvetica", "bold");
    doc.text("Nome Completo", 20, yPosition);
    doc.text("Folgas", 170, yPosition);
    
    yPosition += 8;
    doc.setFont("helvetica", "normal");

    // Employee data
    filteredEmployees.forEach((emp) => {
      // Check if we need a new page
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }

      const nameText = doc.splitTextToSize(emp.nome_completo, 140);
      
      doc.text(nameText, 20, yPosition);
      doc.text(emp.quantidade_folgas.toString(), 170, yPosition);
      
      yPosition += nameText.length * 5 + 3;
    });

    // Footer
    yPosition += 10;
    doc.setFontSize(8);
    doc.text(
      `Total de funcionários: ${filteredEmployees.length}`,
      pageWidth / 2,
      yPosition,
      { align: "center" }
    );

    // Save PDF
    const fileName = `Folgas_Funcionarios_${currentDate.replace(/\//g, "-")}.pdf`;
    doc.save(fileName);
    
    toast.success("Lista exportada em PDF com sucesso!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Folgas na Casa - Relatório de Funcionários</DialogTitle>
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Select value={selectedSetor} onValueChange={setSelectedSetor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um setor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Setores</SelectItem>
                    {setores.map((setor) => (
                      <SelectItem key={setor.id} value={setor.nome}>
                        {setor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Select value={selectedTipoContrato} onValueChange={setSelectedTipoContrato}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de contrato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Contratos</SelectItem>
                    <SelectItem value="fixo">Fixo</SelectItem>
                    <SelectItem value="intermitente">Intermitente</SelectItem>
                    <SelectItem value="prestador_servico">Prestador de Serviço</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <FileText className="w-4 h-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEmployees.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {selectedSetor === "todos" 
                  ? "Nenhum funcionário cadastrado" 
                  : "Nenhum funcionário encontrado neste setor"}
              </p>
            ) : (
              <div className="grid gap-3">
                {filteredEmployees.map((employee) => (
                  <Card key={employee.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">
                            {employee.nome_completo}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {employee.cargo}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">
                              {employee.quantidade_folgas}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {employee.quantidade_folgas === 1 ? "folga" : "folgas"}
                            </p>
                            {employee.ultima_alteracao_folgas && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Alterado em: {dataBR(employee.ultima_alteracao_folgas).toLocaleString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </p>
                            )}
                          </div>
                          <EditTimeOffDialog
                            employeeId={employee.id}
                            employeeName={employee.nome_completo}
                            currentAmount={employee.quantidade_folgas}
                            onUpdated={fetchEmployeeTimeOff}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TimeOffListDialog;

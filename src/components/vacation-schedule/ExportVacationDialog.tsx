import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { dataBR } from "@/lib/date";

interface ExportVacationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters?: any;
}

interface Empresa {
  id: string;
  nome: string;
  logo_url: string | null;
}

interface Setor {
  id: string;
  nome: string;
}

interface VacationExportItem {
  employee_name: string;
  setor: string;
  empresa_nome: string;
  tipo_contrato: string;
  periodo_inicio: string;
  periodo_fim: string;
  dias_totais: number;
  status: string;
}

export function ExportVacationDialog({ open, onOpenChange, filters }: ExportVacationDialogProps) {
  const [ano, setAno] = useState<string>(new Date().getFullYear().toString());
  const [empresaId, setEmpresaId] = useState<string>("all");
  const [setorId, setSetorId] = useState<string>("all");
  const [tipoContrato, setTipoContrato] = useState<string>("all");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

  useEffect(() => {
    if (open) {
      fetchEmpresas();
      fetchSetores();
    }
  }, [open]);

  const fetchEmpresas = async () => {
    const { data } = await supabase.from("empresas").select("id, nome, logo_url").order("nome");
    if (data) setEmpresas(data);
  };

  const fetchSetores = async () => {
    const { data } = await supabase.from("setores").select("id, nome").order("nome");
    if (data) setSetores(data);
  };

  const fetchVacations = async (): Promise<VacationExportItem[]> => {
    const startDate = `${ano}-01-01`;
    const endDate = `${ano}-12-31`;

    let employeesQuery = supabase
      .from("employees")
      .select("id, nome_completo, setor, tipo_contrato, empresa_id, empresas(nome)")
      .in("status", ["ativo", "ferias"]);

    if (empresaId !== "all") {
      employeesQuery = employeesQuery.eq("empresa_id", empresaId);
    }

    if (setorId !== "all") {
      const setor = setores.find(s => s.id === setorId);
      if (setor) {
        employeesQuery = employeesQuery.eq("setor", setor.nome);
      }
    }

    if (tipoContrato !== "all") {
      employeesQuery = employeesQuery.eq("tipo_contrato", tipoContrato as "fixo" | "intermitente" | "prestador_servico");
    }

    const { data: employees } = await employeesQuery;

    if (!employees || employees.length === 0) return [];

    const employeesById: Record<string, any> = {};
    for (const emp of employees) {
      employeesById[emp.id] = emp;
    }

    const employeeIds = employees.map((e: any) => e.id);

    // Férias planejadas no ano
    const { data: plannedData } = await supabase
      .from("ferias_planejadas")
      .select("*")
      .in("employee_id", employeeIds)
      .gte("periodo_inicio", startDate)
      .lte("periodo_inicio", endDate);

    // Férias confirmadas no ano
    const { data: confirmedData } = await supabase
      .from("ferias")
      .select("*")
      .in("employee_id", employeeIds)
      .gte("periodo_gozo_inicio", startDate)
      .lte("periodo_gozo_inicio", endDate);

    const allVacations: VacationExportItem[] = [];
    const now = new Date();

    const getTipoContratoLabel = (tipo: string | null) => {
      const labels: Record<string, string> = {
        fixo: "Fixo",
        intermitente: "Intermitente",
        prestador_servico: "Prestador de Serviço",
      };
      return labels[tipo || ""] || tipo || "-";
    };

    const getStatusLabel = (status: string) => {
      const labels: Record<string, string> = {
        planejado: "Planejado",
        aprovado: "Aprovado",
        em_andamento: "Em Andamento",
        concluido: "Concluído",
      };
      return labels[status] || status;
    };

    (plannedData || []).forEach((item: any) => {
      const emp = employeesById[item.employee_id];
      if (!emp) return;
      allVacations.push({
        employee_name: emp.nome_completo,
        setor: emp.setor || "Sem Setor",
        empresa_nome: emp.empresas?.nome || "Sem Empresa",
        tipo_contrato: getTipoContratoLabel(emp.tipo_contrato),
        periodo_inicio: item.periodo_inicio,
        periodo_fim: item.periodo_fim,
        dias_totais: item.dias_totais,
        status: getStatusLabel(item.status || "planejado"),
      });
    });

    (confirmedData || []).forEach((item: any) => {
      const emp = employeesById[item.employee_id];
      if (!emp) return;
      const start = dataBR(item.periodo_gozo_inicio);
      const end = dataBR(item.periodo_gozo_fim);
      let status: string;
      if (now < start) status = "Aprovado";
      else if (now > end) status = "Concluído";
      else status = "Em Andamento";

      allVacations.push({
        employee_name: emp.nome_completo,
        setor: emp.setor || "Sem Setor",
        empresa_nome: emp.empresas?.nome || "Sem Empresa",
        tipo_contrato: getTipoContratoLabel(emp.tipo_contrato),
        periodo_inicio: item.periodo_gozo_inicio,
        periodo_fim: item.periodo_gozo_fim,
        dias_totais: item.dias_totais,
        status,
      });
    });

    allVacations.sort((a, b) => 
      dataBR(a.periodo_inicio).getTime() - dataBR(b.periodo_inicio).getTime()
    );

    return allVacations;
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(dataBR(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getFilterDescription = () => {
    const parts: string[] = [`Ano: ${ano}`];
    
    if (empresaId !== "all") {
      const empresa = empresas.find(e => e.id === empresaId);
      parts.push(`Empresa: ${empresa?.nome || "-"}`);
    }
    
    if (setorId !== "all") {
      const setor = setores.find(s => s.id === setorId);
      parts.push(`Setor: ${setor?.nome || "-"}`);
    }
    
    if (tipoContrato !== "all") {
      const labels: Record<string, string> = {
        fixo: "Fixo",
        intermitente: "Intermitente",
        prestador_servico: "Prestador de Serviço",
      };
      parts.push(`Tipo Contrato: ${labels[tipoContrato] || tipoContrato}`);
    }
    
    return parts.join(" | ");
  };

  const handleExportPDF = async () => {
    setLoading(true);
    try {
      const vacations = await fetchVacations();

      if (vacations.length === 0) {
        toast.error("Nenhuma féria encontrada com os filtros selecionados");
        setLoading(false);
        return;
      }

      const doc = new jsPDF();
      
      // Logo da empresa selecionada
      if (empresaId !== "all") {
        const empresa = empresas.find(e => e.id === empresaId);
        if (empresa?.logo_url) {
          try {
            doc.addImage(empresa.logo_url, "PNG", 14, 10, 20, 20);
          } catch (e) {
            console.error("Erro ao adicionar logo:", e);
          }
        }
      }

      doc.setFontSize(16);
      doc.text("Relatório de Férias Planejadas", 14, 40);
      
      doc.setFontSize(10);
      doc.text(getFilterDescription(), 14, 48);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 54);

      const tableData = vacations.map(v => [
        v.employee_name,
        v.setor,
        v.empresa_nome,
        v.tipo_contrato,
        `${formatDate(v.periodo_inicio)} - ${formatDate(v.periodo_fim)}`,
        v.dias_totais.toString(),
        v.status,
      ]);

      autoTable(doc, {
        startY: 60,
        head: [["Funcionário", "Setor", "Empresa", "Contrato", "Período", "Dias", "Status"]],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      // Totais
      const totalDias = vacations.reduce((sum, v) => sum + v.dias_totais, 0);
      const finalY = (doc as any).lastAutoTable.finalY || 60;
      
      doc.setFontSize(10);
      doc.text(`Total de registros: ${vacations.length}`, 14, finalY + 10);
      doc.text(`Total de dias: ${totalDias}`, 14, finalY + 16);

      doc.save(`ferias-planejadas-${ano}.pdf`);
      toast.success("PDF exportado com sucesso!");
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao exportar PDF");
    }
    setLoading(false);
  };

  const handleExportExcel = async () => {
    setLoading(true);
    try {
      const vacations = await fetchVacations();

      if (vacations.length === 0) {
        toast.error("Nenhuma féria encontrada com os filtros selecionados");
        setLoading(false);
        return;
      }

      const data = vacations.map(v => ({
        "Funcionário": v.employee_name,
        "Setor": v.setor,
        "Empresa": v.empresa_nome,
        "Tipo Contrato": v.tipo_contrato,
        "Início": formatDate(v.periodo_inicio),
        "Fim": formatDate(v.periodo_fim),
        "Dias": v.dias_totais,
        "Status": v.status,
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Férias");
      XLSX.writeFile(wb, `ferias-planejadas-${ano}.xlsx`);
      
      toast.success("Excel exportado com sucesso!");
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao exportar Excel:", error);
      toast.error("Erro ao exportar Excel");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Lista de Férias</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Ano</Label>
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {empresas.map(empresa => (
                  <SelectItem key={empresa.id} value={empresa.id}>{empresa.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Setor</Label>
            <Select value={setorId} onValueChange={setSetorId}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {setores.map(setor => (
                  <SelectItem key={setor.id} value={setor.id}>{setor.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Contrato</Label>
            <Select value={tipoContrato} onValueChange={setTipoContrato}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="fixo">Fixo</SelectItem>
                <SelectItem value="intermitente">Intermitente</SelectItem>
                <SelectItem value="prestador_servico">Prestador de Serviço</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleExportPDF}
              disabled={loading}
              className="flex-1"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
            <Button
              onClick={handleExportExcel}
              disabled={loading}
              variant="outline"
              className="flex-1"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

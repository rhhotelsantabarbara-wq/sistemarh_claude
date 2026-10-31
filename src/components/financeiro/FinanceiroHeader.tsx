import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Wallet } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";

interface FinanceiroHeaderProps {
  onExportPDF: () => void;
  onExportExcel: () => void;
}

export function FinanceiroHeader({ onExportPDF, onExportExcel }: FinanceiroHeaderProps) {
  return (
    <div className="mb-6">
      <PageHeader
        titulo="Controle financeiro"
        descricao="Análise completa de gastos com pessoal"
        icone={Wallet}
        acoes={<>
          <Button variant="outline" onClick={onExportPDF}><Download className="h-4 w-4" />PDF</Button>
          <Button variant="outline" onClick={onExportExcel}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
        </>}
      />
    </div>
  );
}

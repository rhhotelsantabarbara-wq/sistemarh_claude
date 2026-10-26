import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { toast } from "sonner";

import { FinanceiroHeader } from "@/components/financeiro/FinanceiroHeader";
import { FinanceiroFilters } from "@/components/financeiro/FinanceiroFilters";
import { FinanceiroKPIs } from "@/components/financeiro/FinanceiroKPIs";
import { GastosPorSetor } from "@/components/financeiro/GastosPorSetor";
import { GastosPorContrato } from "@/components/financeiro/GastosPorContrato";
import { HistoricoMensal } from "@/components/financeiro/HistoricoMensal";
import { AnaliseVariacoes } from "@/components/financeiro/AnaliseVariacoes";
import { AnaliseTendencias } from "@/components/financeiro/AnaliseTendencias";
import { useFinanceiroData, type FinanceiroFilters as FilterType } from "@/components/financeiro/hooks/useFinanceiroData";
import { todayISO } from "@/lib/date";

const Financeiro = () => {
  const [filters, setFilters] = useState<FilterType>({
    empresa: "all",
    periodo: "12months",
    setor: "all",
    tipoContrato: "all",
    tipoFolha: "all",
  });

  const {
    loading,
    empresas,
    setores,
    kpis,
    gastosPorSetor,
    gastosPorContrato,
    historicoMensal,
    variacoesFuncionarios,
    tendencia,
    evolucaoPorContrato,
  } = useFinanceiroData(filters);

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(18);
    doc.text("RELATÓRIO FINANCEIRO", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, pageWidth / 2, 28, { align: "center" });

    let y = 45;
    doc.setFontSize(14);
    doc.text("Resumo", 20, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Valor Bruto: R$ ${kpis.totalBruto.toLocaleString("pt-BR")}`, 20, y); y += 5;
    doc.text(`INSS: R$ ${kpis.totalInss.toLocaleString("pt-BR")}`, 20, y); y += 5;
    doc.text(`FGTS: R$ ${kpis.totalFgts.toLocaleString("pt-BR")}`, 20, y); y += 5;
    doc.text(`IRRF: R$ ${kpis.totalIrrf.toLocaleString("pt-BR")}`, 20, y); y += 5;
    doc.text(`Valor Líquido: R$ ${kpis.totalLiquido.toLocaleString("pt-BR")}`, 20, y); y += 5;
    doc.text(`Holerite Principal: R$ ${kpis.totalPrincipal.toLocaleString("pt-BR")} (${kpis.quantidadePrincipal})`, 20, y); y += 5;
    doc.text(`Holerite Diferença: R$ ${kpis.totalDiferenca.toLocaleString("pt-BR")} (${kpis.quantidadeDiferenca})`, 20, y); y += 5;
    doc.text(`Variação Mensal: ${kpis.variacaoMensal.toFixed(1)}%`, 20, y); y += 5;
    doc.text(`Funcionários: ${kpis.totalFuncionarios}`, 20, y); y += 12;

    doc.setFontSize(14);
    doc.text("Gastos por Setor", 20, y);
    y += 10;
    doc.setFontSize(10);
    gastosPorSetor.forEach((setor) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(`${setor.setor}: R$ ${setor.custoTotal.toLocaleString("pt-BR")} (${setor.quantidadeFuncionarios} func.)`, 20, y);
      y += 6;
    });

    doc.save(`relatorio-financeiro-${todayISO()}.pdf`);
    toast.success("PDF exportado com sucesso!");
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Resumo
    const resumo = [
      ["Valor Bruto", kpis.totalBruto],
      ["INSS", kpis.totalInss],
      ["FGTS", kpis.totalFgts],
      ["IRRF", kpis.totalIrrf],
      ["Valor Líquido", kpis.totalLiquido],
      ["Holerite Principal", kpis.totalPrincipal],
      ["Qtd Holerite Principal", kpis.quantidadePrincipal],
      ["Holerite Diferença", kpis.totalDiferenca],
      ["Qtd Holerite Diferença", kpis.quantidadeDiferenca],
      ["Variação Mensal (%)", kpis.variacaoMensal],
      ["Custo Médio/Funcionário", kpis.custoMedioFuncionario],
      ["Total Funcionários", kpis.totalFuncionarios],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");

    // Gastos por Setor
    const setorData = gastosPorSetor.map(s => ({
      Setor: s.setor,
      "Custo Total": s.custoTotal,
      Funcionários: s.quantidadeFuncionarios,
      "Custo Médio": s.custoMedio,
      "Variação (%)": s.variacao,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(setorData), "Por Setor");

    // Histórico
    const historicoData = historicoMensal.map(h => ({
      "Mês/Ano": `${h.mes}/${h.ano}`,
      "Valor Bruto": h.totalBruto,
      "INSS": h.totalInss,
      "FGTS": h.totalFgts,
      "IRRF": h.totalIrrf,
      "Descontos": h.totalDescontos,
      "Valor Líquido": h.totalLiquido,
      "Holerite Diferença": h.totalDiferenca,
      "Holerite Principal": h.totalPrincipal,
      "Pagamentos": h.quantidadePagamentos,
      "Variação (%)": h.diferencaPercentual,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(historicoData), "Histórico");

    XLSX.writeFile(wb, `relatorio-financeiro-${todayISO()}.xlsx`);
    toast.success("Excel exportado com sucesso!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-16 w-full mb-6" />
          <Skeleton className="h-12 w-full mb-6" />
          <div className="grid grid-cols-6 gap-4 mb-6">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <FinanceiroHeader onExportPDF={exportToPDF} onExportExcel={exportToExcel} />
        
        <FinanceiroFilters
          filters={filters}
          setFilters={setFilters}
          empresas={empresas}
          setores={setores}
        />

        <FinanceiroKPIs kpis={kpis} />

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <GastosPorSetor data={gastosPorSetor} />
          <GastosPorContrato data={gastosPorContrato} evolucao={evolucaoPorContrato} />
        </div>

        <div className="mb-6">
          <HistoricoMensal data={historicoMensal} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <AnaliseVariacoes data={variacoesFuncionarios} />
          <AnaliseTendencias historico={historicoMensal} tendencia={tendencia} />
        </div>
      </div>
    </div>
  );
};

export default Financeiro;

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { dataBR } from "@/lib/date";

interface Pagamento {
  id: string;
  employee_id: string;
  valor_bruto: number;
  desconto: number;
  descontos: number;
  valor_liquido: number;
  observacoes: string | null;
  tipo_folha?: string | null;
  mes: number;
  ano: number;
  employees: {
    nome_completo: string;
    cargo: string;
    tipo_contrato: string;
    setor: string | null;
    cpf?: string;
    data_admissao?: string;
  };
  folha_pagamento_itens?: {
    id: string;
    variavel_id: string;
    valor: number;
    variaveis_folha: {
      id: string;
      nome: string;
      tipo: "desconto" | "provento";
      codigo?: string | null;
    };
  }[];
}

interface RelatorioDetalhadoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pagamentos: Pagamento[];
  empresaId: string;
  empresaNome: string;
  mes: number;
  ano: number;
}

type TipoRelatorio = "resumido" | "detalhado" | "completo";
type OrdenarPor = "nome" | "salario" | "setor";
type AgruparPor = "nenhum" | "setor" | "tipo_contrato";

const RelatorioDetalhadoDialog = ({
  open,
  onOpenChange,
  pagamentos,
  empresaId,
  empresaNome,
  mes,
  ano,
}: RelatorioDetalhadoDialogProps) => {
  const [tipoRelatorio, setTipoRelatorio] = useState<TipoRelatorio>("detalhado");
  const [ordenarPor, setOrdenarPor] = useState<OrdenarPor>("nome");
  const [agruparPor, setAgruparPor] = useState<AgruparPor>("nenhum");
  const [incluirDadosFuncionario, setIncluirDadosFuncionario] = useState(true);
  const [incluirCodigoVariaveis, setIncluirCodigoVariaveis] = useState(true);
  const [incluirResumoSetor, setIncluirResumoSetor] = useState(true);
  const [incluirResumoContrato, setIncluirResumoContrato] = useState(true);
  const [incluirComparativo, setIncluirComparativo] = useState(false);
  const [loading, setLoading] = useState(false);

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return dataBR(dateString).toLocaleDateString("pt-BR");
  };

  const getTipoContratoLabel = (tipo: string) => {
    switch (tipo) {
      case "fixo": return "Fixo";
      case "intermitente": return "Intermitente";
      case "prestador_servico": return "Prestador de Serviço";
      default: return tipo;
    }
  };

  const getMesAnterior = () => {
    if (mes === 1) {
      return { mes: 12, ano: ano - 1 };
    }
    return { mes: mes - 1, ano };
  };

  const gerarRelatorio = async () => {
    setLoading(true);

    try {
      // Fetch additional employee data (CPF, data_admissao)
      const employeeIds = pagamentos.map(p => p.employee_id);
      const { data: employeesData } = await supabase
        .from("employees")
        .select("id, cpf, data_admissao")
        .in("id", employeeIds);

      // Fetch company logo (somente quando uma empresa específica está selecionada)
      const empresaEspecifica = empresaId && empresaId !== "all";
      let empresaData: { logo_url: string | null; cnpj: string | null } | null = null;
      if (empresaEspecifica) {
        const { data } = await supabase
          .from("empresas")
          .select("logo_url, cnpj")
          .eq("id", empresaId)
          .maybeSingle();
        empresaData = (data as any) || null;
      }

      // Fetch previous month data if needed
      let pagamentosAnteriores: Pagamento[] = [];
      if (incluirComparativo && tipoRelatorio === "completo") {
        const mesAnterior = getMesAnterior();
        let query = supabase
          .from("folha_pagamento")
          .select(`
            id, employee_id, valor_bruto, desconto, descontos, valor_liquido, observacoes, tipo_folha, mes, ano,
            employees (nome_completo, cargo, tipo_contrato, setor)
          `)
          .eq("mes", mesAnterior.mes)
          .eq("ano", mesAnterior.ano);
        if (empresaEspecifica) query = query.eq("empresa_id", empresaId);
        const { data } = await query;

        pagamentosAnteriores = (data || []) as any;
      }


      // Merge employee data
      const pagamentosComDados = pagamentos.map(p => {
        const empData = employeesData?.find(e => e.id === p.employee_id);
        return {
          ...p,
          employees: {
            ...p.employees,
            cpf: empData?.cpf || "",
            data_admissao: empData?.data_admissao || "",
          },
        };
      });

      // Sort data
      const pagamentosOrdenados = [...pagamentosComDados].sort((a, b) => {
        switch (ordenarPor) {
          case "nome":
            return a.employees.nome_completo.localeCompare(b.employees.nome_completo);
          case "salario":
            return b.valor_bruto - a.valor_bruto;
          case "setor":
            return (a.employees.setor || "").localeCompare(b.employees.setor || "");
          default:
            return 0;
        }
      });

      // Generate PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const mesNome = new Date(ano, mes - 1).toLocaleString("pt-BR", { month: "long" });
      const dataGeracao = new Date().toLocaleString("pt-BR");

      let yPosition = 20;

      // === CAPA ===
      // Logo
      if (empresaData?.logo_url) {
        try {
          doc.addImage(empresaData.logo_url, "PNG", pageWidth / 2 - 15, yPosition, 30, 30);
          yPosition += 40;
        } catch {
          yPosition += 10;
        }
      }

      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO DETALHADO", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 8;
      doc.text("FOLHA DE PAGAMENTO", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 15;

      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text(`Empresa: ${empresaNome}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 7;
      if (empresaData?.cnpj) {
        doc.setFontSize(10);
        doc.text(`CNPJ: ${empresaData.cnpj}`, pageWidth / 2, yPosition, { align: "center" });
        yPosition += 7;
      }
      doc.setFontSize(12);
      doc.text(`Período: ${mesNome.charAt(0).toUpperCase() + mesNome.slice(1)}/${ano}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 7;
      doc.setFontSize(10);
      doc.text(`Gerado em: ${dataGeracao}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 20;

      // Totais na capa (formato original)
      const totalFuncionarios = pagamentosOrdenados.length;
      const totalBruto = pagamentosOrdenados.reduce((sum, p) => sum + p.valor_bruto, 0);

      // Valor em Conta = soma dos itens da variável "Valor em Conta" (código 3503)
      const somarValorEmConta = (p: Pagamento) => {
        const itens = p.folha_pagamento_itens || [];
        return itens
          .filter(
            i =>
              i.variaveis_folha?.codigo === "3503" ||
              i.variaveis_folha?.nome?.toLowerCase().includes("valor em conta")
          )
          .reduce((sum, i) => sum + (i.valor || 0), 0);
      };

      const totalEmConta = pagamentosOrdenados.reduce((sum, p) => sum + somarValorEmConta(p), 0);
      // Valor em Mãos = Total Bruto - Valor em Conta
      const totalEmMaos = totalBruto - totalEmConta;

      doc.setFillColor(240, 240, 240);
      doc.roundedRect(30, yPosition, pageWidth - 60, 48, 3, 3, "F");

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      yPosition += 12;
      doc.text(`Total de Funcionários: ${totalFuncionarios}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 10;
      doc.text(`Total Bruto: ${formatCurrency(totalBruto)}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 10;
      doc.setTextColor(0, 0, 120);
      doc.text(`Total em Conta: ${formatCurrency(totalEmConta)}`, pageWidth / 2, yPosition, { align: "center" });
      doc.setTextColor(0, 0, 0);
      yPosition += 10;
      doc.setTextColor(0, 100, 0);
      doc.text(`Total em Mãos: ${formatCurrency(totalEmMaos)}`, pageWidth / 2, yPosition, { align: "center" });
      doc.setTextColor(0, 0, 0);

      // === PÁGINA 2: SUMÁRIO EXECUTIVO ===
      doc.addPage();
      yPosition = 20;

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("SUMÁRIO EXECUTIVO", 20, yPosition);
      yPosition += 15;

      // Totais por tipo de contrato
      if (incluirResumoContrato) {
        doc.setFontSize(12);
        doc.text("TOTAIS POR TIPO DE CONTRATO", 20, yPosition);
        yPosition += 5;

        const resumoPorContrato = pagamentosOrdenados.reduce((acc, p) => {
          const tipo = p.employees.tipo_contrato || "outros";
          if (!acc[tipo]) {
            acc[tipo] = { qtd: 0, bruto: 0, liquido: 0 };
          }
          acc[tipo].qtd++;
          acc[tipo].bruto += p.valor_bruto;
          acc[tipo].liquido += p.valor_liquido;
          return acc;
        }, {} as Record<string, { qtd: number; bruto: number; liquido: number }>);

        const contratoData = Object.entries(resumoPorContrato).map(([tipo, dados]) => [
          getTipoContratoLabel(tipo),
          dados.qtd.toString(),
          formatCurrency(dados.bruto),
          formatCurrency(dados.liquido),
        ]);

        contratoData.push([
          "TOTAL",
          totalFuncionarios.toString(),
          formatCurrency(totalBruto),
          formatCurrency(totalEmConta),
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [["Tipo", "Qtd. Func.", "Total Bruto", "Total Líquido"]],
          body: contratoData,
          theme: "striped",
          headStyles: { fillColor: [66, 66, 66] },
          foot: [],
          styles: { fontSize: 9 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Totais por setor
      if (incluirResumoSetor) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("TOTAIS POR SETOR", 20, yPosition);
        yPosition += 5;

        const resumoPorSetor = pagamentosOrdenados.reduce((acc, p) => {
          const setor = p.employees.setor || "Sem Setor";
          if (!acc[setor]) {
            acc[setor] = { qtd: 0, bruto: 0, liquido: 0 };
          }
          acc[setor].qtd++;
          acc[setor].bruto += p.valor_bruto;
          acc[setor].liquido += p.valor_liquido;
          return acc;
        }, {} as Record<string, { qtd: number; bruto: number; liquido: number }>);

        const setorData = Object.entries(resumoPorSetor)
          .sort((a, b) => b[1].bruto - a[1].bruto)
          .map(([setor, dados]) => [
            setor,
            dados.qtd.toString(),
            formatCurrency(dados.bruto),
            formatCurrency(dados.liquido),
          ]);

        setorData.push([
          "TOTAL",
          totalFuncionarios.toString(),
          formatCurrency(totalBruto),
          formatCurrency(totalEmConta),
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [["Setor", "Qtd. Func.", "Total Bruto", "Total Líquido"]],
          body: setorData,
          theme: "striped",
          headStyles: { fillColor: [66, 66, 66] },
          styles: { fontSize: 9 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // === PÁGINA 3: ANÁLISE POR VARIÁVEL ===
      doc.addPage();
      yPosition = 20;

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("ANÁLISE DETALHADA POR VARIÁVEL", 20, yPosition);
      yPosition += 15;

      // Coletar todas as variáveis
      const resumoVariaveis: Record<string, { 
        codigo: string; 
        nome: string; 
        tipo: string; 
        qtd: number; 
        total: number 
      }> = {};

      pagamentosOrdenados.forEach(p => {
        if (p.folha_pagamento_itens) {
          p.folha_pagamento_itens.forEach(item => {
            const varId = item.variavel_id;
            if (!resumoVariaveis[varId]) {
              resumoVariaveis[varId] = {
                codigo: item.variaveis_folha?.codigo || "-",
                nome: item.variaveis_folha?.nome || "Desconhecido",
                tipo: item.variaveis_folha?.tipo || "desconto",
                qtd: 0,
                total: 0,
              };
            }
            resumoVariaveis[varId].qtd++;
            resumoVariaveis[varId].total += item.valor;
          });
        }
      });

      const proventos = Object.values(resumoVariaveis).filter(v => v.tipo === "provento");
      const descontos = Object.values(resumoVariaveis).filter(v => v.tipo === "desconto");
      const totalProventos = proventos.reduce((sum, v) => sum + v.total, 0);
      const totalDescontosVar = descontos.reduce((sum, v) => sum + v.total, 0);

      if (proventos.length > 0) {
        doc.setFontSize(12);
        doc.text("PROVENTOS DETALHADOS", 20, yPosition);
        yPosition += 5;

        const proventosData = proventos
          .sort((a, b) => b.total - a.total)
          .map(v => [
            incluirCodigoVariaveis ? v.codigo : "",
            v.nome,
            v.qtd.toString(),
            formatCurrency(v.total),
            `${((v.total / totalBruto) * 100).toFixed(1)}%`,
          ]);

        proventosData.push([
          "",
          "TOTAL PROVENTOS",
          "",
          formatCurrency(totalProventos),
          `${((totalProventos / totalBruto) * 100).toFixed(1)}%`,
        ]);

        const headers = incluirCodigoVariaveis 
          ? [["Código", "Variável", "Qtd. Func.", "Total", "% Total"]]
          : [["Variável", "Qtd. Func.", "Total", "% Total"]];

        autoTable(doc, {
          startY: yPosition,
          head: headers,
          body: incluirCodigoVariaveis ? proventosData : proventosData.map(row => row.slice(1)),
          theme: "striped",
          headStyles: { fillColor: [34, 139, 34] },
          styles: { fontSize: 9 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      if (descontos.length > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("DESCONTOS DETALHADOS", 20, yPosition);
        yPosition += 5;

        const descontosData = descontos
          .sort((a, b) => b.total - a.total)
          .map(v => [
            incluirCodigoVariaveis ? v.codigo : "",
            v.nome,
            v.qtd.toString(),
            formatCurrency(v.total),
            `${((v.total / totalBruto) * 100).toFixed(1)}%`,
          ]);

        descontosData.push([
          "",
          "TOTAL DESCONTOS",
          "",
          formatCurrency(totalDescontosVar),
          `${((totalDescontosVar / totalBruto) * 100).toFixed(1)}%`,
        ]);

        const headers = incluirCodigoVariaveis 
          ? [["Código", "Variável", "Qtd. Func.", "Total", "% Bruto"]]
          : [["Variável", "Qtd. Func.", "Total", "% Bruto"]];

        autoTable(doc, {
          startY: yPosition,
          head: headers,
          body: incluirCodigoVariaveis ? descontosData : descontosData.map(row => row.slice(1)),
          theme: "striped",
          headStyles: { fillColor: [178, 34, 34] },
          styles: { fontSize: 9 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // === PÁGINAS DE FUNCIONÁRIOS ===
      if (tipoRelatorio !== "resumido") {
        doc.addPage();
        yPosition = 20;

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("DETALHAMENTO POR FUNCIONÁRIO", 20, yPosition);
        yPosition += 15;

        // Agrupar se necessário
        let grupos: { nome: string; pagamentos: typeof pagamentosOrdenados }[] = [];

        if (agruparPor === "setor") {
          const porSetor = pagamentosOrdenados.reduce((acc, p) => {
            const setor = p.employees.setor || "Sem Setor";
            if (!acc[setor]) acc[setor] = [];
            acc[setor].push(p);
            return acc;
          }, {} as Record<string, typeof pagamentosOrdenados>);

          grupos = Object.entries(porSetor).map(([nome, pags]) => ({ nome, pagamentos: pags }));
        } else if (agruparPor === "tipo_contrato") {
          const porContrato = pagamentosOrdenados.reduce((acc, p) => {
            const tipo = getTipoContratoLabel(p.employees.tipo_contrato);
            if (!acc[tipo]) acc[tipo] = [];
            acc[tipo].push(p);
            return acc;
          }, {} as Record<string, typeof pagamentosOrdenados>);

          grupos = Object.entries(porContrato).map(([nome, pags]) => ({ nome, pagamentos: pags }));
        } else {
          grupos = [{ nome: "", pagamentos: pagamentosOrdenados }];
        }

        grupos.forEach((grupo) => {
          if (grupo.nome) {
            if (yPosition > pageHeight - 50) {
              doc.addPage();
              yPosition = 20;
            }

            doc.setFillColor(66, 66, 66);
            doc.rect(20, yPosition - 5, pageWidth - 40, 10, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text(grupo.nome.toUpperCase(), 25, yPosition + 2);
            doc.setTextColor(0, 0, 0);
            yPosition += 15;
          }

          grupo.pagamentos.forEach((pag) => {
            if (yPosition > pageHeight - 80) {
              doc.addPage();
              yPosition = 20;
            }

            // Cabeçalho do funcionário
            doc.setFillColor(240, 240, 240);
            doc.rect(20, yPosition - 5, pageWidth - 40, incluirDadosFuncionario ? 20 : 12, "F");

            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text(pag.employees.nome_completo, 25, yPosition + 2);

            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            const cargoSetor = `${pag.employees.cargo} | ${pag.employees.setor || "Sem Setor"} | ${getTipoContratoLabel(pag.employees.tipo_contrato)}`;
            doc.text(cargoSetor, 25, yPosition + 8);

            if (incluirDadosFuncionario) {
              const cpfAdmissao = `CPF: ${pag.employees.cpf || "-"} | Admissão: ${pag.employees.data_admissao ? formatDate(pag.employees.data_admissao) : "-"}`;
              doc.text(cpfAdmissao, 25, yPosition + 14);
              yPosition += 25;
            } else {
              yPosition += 17;
            }

            // Proventos e Descontos
            const proventosFunc = pag.folha_pagamento_itens?.filter(i => i.variaveis_folha?.tipo === "provento") || [];
            const descontosFunc = pag.folha_pagamento_itens?.filter(i => i.variaveis_folha?.tipo === "desconto") || [];

            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("PROVENTOS:", 25, yPosition);
            yPosition += 5;

            doc.setFont("helvetica", "normal");
            const codigoPrefix = incluirCodigoVariaveis;
            doc.text(`  Salário Base: ${formatCurrency(pag.valor_bruto)}`, 25, yPosition);
            yPosition += 5;

            proventosFunc.forEach(item => {
              const codigo = codigoPrefix && item.variaveis_folha?.codigo ? `[${item.variaveis_folha.codigo}] ` : "";
              doc.text(`  ${codigo}${item.variaveis_folha?.nome}: ${formatCurrency(item.valor)}`, 25, yPosition);
              yPosition += 5;
            });

            const totalProventosFunc = pag.valor_bruto + proventosFunc.reduce((sum, i) => sum + i.valor, 0);
            doc.setFont("helvetica", "bold");
            doc.text(`  TOTAL: ${formatCurrency(totalProventosFunc)}`, 25, yPosition);
            yPosition += 8;

            if (descontosFunc.length > 0 || pag.desconto > 0) {
              doc.setFont("helvetica", "bold");
              doc.text("DESCONTOS:", 25, yPosition);
              yPosition += 5;

              doc.setFont("helvetica", "normal");
              descontosFunc.forEach(item => {
                const codigo = codigoPrefix && item.variaveis_folha?.codigo ? `[${item.variaveis_folha.codigo}] ` : "";
                doc.text(`  ${codigo}${item.variaveis_folha?.nome}: ${formatCurrency(item.valor)}`, 25, yPosition);
                yPosition += 5;
              });

              if (pag.desconto > 0) {
                doc.text(`  Outros Descontos: ${formatCurrency(pag.desconto)}`, 25, yPosition);
                yPosition += 5;
              }

              const totalDescontosFunc = descontosFunc.reduce((sum, i) => sum + i.valor, 0) + (pag.desconto || 0);
              doc.setFont("helvetica", "bold");
              doc.text(`  TOTAL: ${formatCurrency(totalDescontosFunc)}`, 25, yPosition);
              yPosition += 8;
            }

            // Holerite principal => "VALOR EM CONTA"; holerite de diferença => "VALOR EM MÃOS"
            const rotuloValor = pag.tipo_folha === "diferenca" ? "VALOR EM MÃOS" : "VALOR EM CONTA";
            doc.setFillColor(34, 139, 34);
            doc.rect(20, yPosition - 3, pageWidth - 40, 8, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.text(`${rotuloValor}: ${formatCurrency(pag.valor_liquido)}`, pageWidth / 2, yPosition + 2, { align: "center" });
            doc.setTextColor(0, 0, 0);
            yPosition += 12;

            if (pag.observacoes) {
              doc.setFontSize(8);
              doc.setFont("helvetica", "italic");
              doc.text(`Obs: ${pag.observacoes}`, 25, yPosition);
              yPosition += 8;
            }

            yPosition += 5;
          });
        });
      }

      // === COMPARATIVO COM MÊS ANTERIOR ===
      if (tipoRelatorio === "completo" && incluirComparativo && pagamentosAnteriores.length > 0) {
        doc.addPage();
        yPosition = 20;

        const mesAnterior = getMesAnterior();
        const mesAnteriorNome = new Date(mesAnterior.ano, mesAnterior.mes - 1).toLocaleString("pt-BR", { month: "long" });

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("COMPARATIVO COM MÊS ANTERIOR", 20, yPosition);
        yPosition += 15;

        const totalBrutoAnterior = pagamentosAnteriores.reduce((sum, p) => sum + p.valor_bruto, 0);
        const totalLiquidoAnterior = pagamentosAnteriores.reduce((sum, p) => sum + p.valor_liquido, 0);
        const totalDescontosAnterior = pagamentosAnteriores.reduce((sum, p) => sum + (p.desconto || 0), 0);

        const variacaoBruto = totalBrutoAnterior > 0 ? ((totalBruto - totalBrutoAnterior) / totalBrutoAnterior) * 100 : 0;
        const variacaoLiquido = totalLiquidoAnterior > 0 ? ((totalEmConta - totalLiquidoAnterior) / totalLiquidoAnterior) * 100 : 0;
        const variacaoFunc = pagamentosAnteriores.length > 0 ? totalFuncionarios - pagamentosAnteriores.length : 0;

        const comparativoData = [
          [
            "Total Funcionários",
            pagamentosAnteriores.length.toString(),
            totalFuncionarios.toString(),
            `${variacaoFunc >= 0 ? "+" : ""}${variacaoFunc}`,
          ],
          [
            "Total Bruto",
            formatCurrency(totalBrutoAnterior),
            formatCurrency(totalBruto),
            `${variacaoBruto >= 0 ? "+" : ""}${variacaoBruto.toFixed(1)}%`,
          ],
          [
            "Total em Conta",
            formatCurrency(totalLiquidoAnterior),
            formatCurrency(totalEmConta),
            `${variacaoLiquido >= 0 ? "+" : ""}${variacaoLiquido.toFixed(1)}%`,
          ],
          [
            "Total em Mãos",
            formatCurrency(totalDescontosAnterior),
            formatCurrency(totalEmMaos),
            "-",
          ],
        ];

        autoTable(doc, {
          startY: yPosition,
          head: [[
            "",
            `${mesAnteriorNome.charAt(0).toUpperCase() + mesAnteriorNome.slice(1)}/${mesAnterior.ano}`,
            `${mesNome.charAt(0).toUpperCase() + mesNome.slice(1)}/${ano}`,
            "Variação",
          ]],
          body: comparativoData,
          theme: "grid",
          headStyles: { fillColor: [66, 66, 66] },
          styles: { fontSize: 10 },
          columnStyles: {
            3: { halign: "center" },
          },
        });
      }

      // Footer em todas as páginas
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(
          `Página ${i} de ${pageCount} | ${empresaNome} | ${mesNome.charAt(0).toUpperCase() + mesNome.slice(1)}/${ano}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
      }

      doc.save(`relatorio-detalhado-folha-${mesNome}-${ano}.pdf`);
      toast.success("Relatório gerado com sucesso!");
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      toast.error("Erro ao gerar relatório");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Gerar Relatório Detalhado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Tipo de Relatório</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tipoRelatorio"
                  checked={tipoRelatorio === "resumido"}
                  onChange={() => setTipoRelatorio("resumido")}
                  className="w-4 h-4"
                />
                <span className="text-sm">
                  <strong>Resumido</strong> - Apenas sumário e totais
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tipoRelatorio"
                  checked={tipoRelatorio === "detalhado"}
                  onChange={() => setTipoRelatorio("detalhado")}
                  className="w-4 h-4"
                />
                <span className="text-sm">
                  <strong>Detalhado</strong> - Inclui ficha individual de cada funcionário
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tipoRelatorio"
                  checked={tipoRelatorio === "completo"}
                  onChange={() => setTipoRelatorio("completo")}
                  className="w-4 h-4"
                />
                <span className="text-sm">
                  <strong>Completo</strong> - Detalhado + comparativo com mês anterior
                </span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ordenar por</Label>
              <Select value={ordenarPor} onValueChange={(v) => setOrdenarPor(v as OrdenarPor)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nome">Nome do Funcionário</SelectItem>
                  <SelectItem value="salario">Salário (maior primeiro)</SelectItem>
                  <SelectItem value="setor">Setor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Agrupar por</Label>
              <Select value={agruparPor} onValueChange={(v) => setAgruparPor(v as AgruparPor)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem agrupamento</SelectItem>
                  <SelectItem value="setor">Setor</SelectItem>
                  <SelectItem value="tipo_contrato">Tipo de Contrato</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Opções do Relatório</Label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={incluirDadosFuncionario}
                onCheckedChange={(checked) => setIncluirDadosFuncionario(checked as boolean)}
              />
              <span className="text-sm">Incluir dados do funcionário (CPF, admissão)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={incluirCodigoVariaveis}
                onCheckedChange={(checked) => setIncluirCodigoVariaveis(checked as boolean)}
              />
              <span className="text-sm">Incluir código das variáveis</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={incluirResumoSetor}
                onCheckedChange={(checked) => setIncluirResumoSetor(checked as boolean)}
              />
              <span className="text-sm">Incluir resumo por setor</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={incluirResumoContrato}
                onCheckedChange={(checked) => setIncluirResumoContrato(checked as boolean)}
              />
              <span className="text-sm">Incluir resumo por tipo de contrato</span>
            </label>

            {tipoRelatorio === "completo" && (
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={incluirComparativo}
                  onCheckedChange={(checked) => setIncluirComparativo(checked as boolean)}
                />
                <span className="text-sm">Incluir comparativo com mês anterior</span>
              </label>
            )}
          </div>

          <Button onClick={gerarRelatorio} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Gerar PDF Detalhado
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RelatorioDetalhadoDialog;

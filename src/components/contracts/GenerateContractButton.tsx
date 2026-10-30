import { useState } from "react";
import { parseDateOnly } from "@/lib/date";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GenerateContractButtonProps {
  employee: any;
}

export const GenerateContractButton = ({
  employee,
}: GenerateContractButtonProps) => {
  const [loading, setLoading] = useState(false);

  const generateContract = async () => {
    setLoading(true);
    try {
      // Buscar a função do funcionário
      const { data: funcaoData, error: funcaoError } = await supabase
        .from("funcoes")
        .select("id, nome")
        .eq("nome", employee.cargo)
        .single();

      if (funcaoError) throw new Error("Função não encontrada");

      // Buscar dados da empresa
      let empresaNome = "";
      let empresaCnpj = "";
      let empresaEndereco = "";
      
      if (employee.empresa_id) {
        const { data: empresaData, error: empresaError } = await supabase
          .from("empresas")
          .select("nome, cnpj, endereco")
          .eq("id", employee.empresa_id)
          .maybeSingle();

        if (!empresaError && empresaData) {
          empresaNome = empresaData.nome;
          empresaCnpj = empresaData.cnpj || "";
          empresaEndereco = empresaData.endereco || "";
        }
      }

      // Mapear o tipo de contrato do funcionário para o formato do banco de dados
      const tipoContratoDb = employee.tipo_contrato === "Prestador de Serviço" 
        ? "prestador_servico" 
        : employee.tipo_contrato;

      // Buscar o template de contrato
      const { data: templateData, error: templateError } = await supabase
        .from("modelos_contrato")
        .select("*")
        .eq("funcao_id", funcaoData.id)
        .eq("tipo_contrato", tipoContratoDb)
        .maybeSingle();

      if (templateError) throw templateError;

      if (!templateData) {
        toast.error(
          "Template de contrato não configurado para esta função e tipo de contrato"
        );
        return;
      }

      // Substituir variáveis no template
      let conteudo = templateData.conteudo_template;
      conteudo = conteudo.replace(/\{\{NOME_EMPRESA\}\}/g, empresaNome);
      conteudo = conteudo.replace(/\{\{CNPJ_EMPRESA\}\}/g, empresaCnpj);
      conteudo = conteudo.replace(/\{\{ENDERECO_EMPRESA\}\}/g, empresaEndereco);
      conteudo = conteudo.replace(/\{\{NOME_COMPLETO\}\}/g, employee.nome_completo || "");
      conteudo = conteudo.replace(/\{\{CPF\}\}/g, employee.cpf || "");
      conteudo = conteudo.replace(/\{\{ENDERECO\}\}/g, employee.endereco || "");
      conteudo = conteudo.replace(/\{\{TELEFONE\}\}/g, employee.telefone || "");
      conteudo = conteudo.replace(/\{\{CARGO\}\}/g, employee.cargo || "");
      conteudo = conteudo.replace(/\{\{SETOR\}\}/g, employee.setor || "");
      conteudo = conteudo.replace(
        /\{\{DATA_ADMISSAO\}\}/g,
        employee.data_admissao
          ? format((parseDateOnly(employee.data_admissao) ?? new Date()), "dd/MM/yyyy", {
              locale: ptBR,
            })
          : ""
      );
      conteudo = conteudo.replace(
        /\{\{SALARIO\}\}/g,
        employee.salario
          ? new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(employee.salario)
          : ""
      );
      conteudo = conteudo.replace(
        /\{\{DATA_ATUAL\}\}/g,
        format(new Date(), "dd/MM/yyyy", { locale: ptBR })
      );

      // Gerar PDF com suporte a HTML
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      const lineHeight = 7;
      let y = margin;

      // Converter HTML para texto formatado
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = conteudo;
      
      // Processar cada elemento do HTML
      const processElement = (element: HTMLElement, fontSize = 12, isBold = false, isItalic = false) => {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }

        const tagName = element.tagName?.toLowerCase();
        
        // Determinar estilo baseado na tag
        if (tagName === 'h1') {
          fontSize = 18;
          isBold = true;
        } else if (tagName === 'h2') {
          fontSize = 16;
          isBold = true;
        } else if (tagName === 'h3') {
          fontSize = 14;
          isBold = true;
        } else if (tagName === 'strong' || tagName === 'b') {
          isBold = true;
        } else if (tagName === 'em' || tagName === 'i') {
          isItalic = true;
        }

        // Aplicar estilo
        doc.setFontSize(fontSize);
        const fontStyle = isBold && isItalic ? 'bolditalic' : isBold ? 'bold' : isItalic ? 'italic' : 'normal';
        doc.setFont('helvetica', fontStyle);

        // Processar texto ou filhos
        if (element.childNodes.length === 0 || (element.childNodes.length === 1 && element.childNodes[0].nodeType === 3)) {
          const text = element.textContent || '';
          if (text.trim()) {
            const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
            lines.forEach((line: string) => {
              if (y > pageHeight - margin) {
                doc.addPage();
                y = margin;
              }
              
              // Alinhamento
              const align = element.style?.textAlign || 'left';
              let x = margin;
              if (align === 'center') {
                x = pageWidth / 2;
                doc.text(line, x, y, { align: 'center' });
              } else if (align === 'right') {
                x = pageWidth - margin;
                doc.text(line, x, y, { align: 'right' });
              } else {
                doc.text(line, x, y);
              }
              
              y += lineHeight;
            });
          }
        } else {
          element.childNodes.forEach((child) => {
            if (child.nodeType === 3) {
              const text = child.textContent || '';
              if (text.trim()) {
                const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
                lines.forEach((line: string) => {
                  if (y > pageHeight - margin) {
                    doc.addPage();
                    y = margin;
                  }
                  doc.text(line, margin, y);
                  y += lineHeight;
                });
              }
            } else if (child.nodeType === 1) {
              processElement(child as HTMLElement, fontSize, isBold, isItalic);
            }
          });
        }

        // Adicionar espaço extra após cabeçalhos e parágrafos
        if (['h1', 'h2', 'h3', 'p', 'li'].includes(tagName)) {
          y += 3;
        }
      };

      // Processar todos os elementos do HTML
      Array.from(tempDiv.children).forEach((child) => {
        processElement(child as HTMLElement);
      });

      // Salvar PDF
      const fileName = `Contrato_${employee.nome_completo}_${format(
        new Date(),
        "ddMMyyyy"
      )}.pdf`;
      doc.save(fileName);

      toast.success("Contrato gerado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao gerar contrato: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={generateContract}
      disabled={loading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileText className="h-4 w-4" />
      )}
      Gerar Contrato
    </Button>
  );
};

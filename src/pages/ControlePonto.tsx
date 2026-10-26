import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, Users, Wallet, ArrowLeft, Tag, AlertTriangle, Settings } from "lucide-react";
import { LancamentoPonto } from "@/components/ponto/LancamentoPonto";
import { LancamentoPontoLote } from "@/components/ponto/LancamentoPontoLote";
import { ConfiguracaoHoras } from "@/components/ponto/ConfiguracaoHoras";
import { RelatoriosPonto } from "@/components/ponto/RelatoriosPonto";
import { BancoHoras } from "@/components/ponto/BancoHoras";
import { EtiquetasPonto } from "@/components/ponto/EtiquetasPonto";
import { AlertasPonto } from "@/components/ponto/AlertasPonto";
import { ConfiguracaoAlertasPonto } from "@/components/ponto/ConfiguracaoAlertasPonto";

export default function ControlePonto() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background sm:p-2 lg:p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <Clock className="h-8 w-8 text-primary" />
                Controle de Ponto
              </h1>
              <p className="text-muted-foreground mt-1">
                Gerencie o registro de horas de trabalho dos funcionários
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="alertas" className="space-y-6">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 p-1">
            <TabsTrigger value="alertas" className="flex min-w-fit items-center gap-2 whitespace-nowrap">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Alertas</span>
            </TabsTrigger>
            <TabsTrigger value="individual" className="flex min-w-fit items-center gap-2 whitespace-nowrap">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Lançamento Individual</span>
            </TabsTrigger>
            <TabsTrigger value="lote" className="flex min-w-fit items-center gap-2 whitespace-nowrap">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Lançamento em Lote</span>
            </TabsTrigger>
            <TabsTrigger value="configuracao" className="flex min-w-fit items-center gap-2 whitespace-nowrap">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Configuração de Horas</span>
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="flex min-w-fit items-center gap-2 whitespace-nowrap">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Relatórios</span>
            </TabsTrigger>
            <TabsTrigger value="banco" className="flex min-w-fit items-center gap-2 whitespace-nowrap">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Banco de Horas</span>
            </TabsTrigger>
            <TabsTrigger value="etiquetas" className="flex min-w-fit items-center gap-2 whitespace-nowrap">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Etiquetas</span>
            </TabsTrigger>
            <TabsTrigger value="config-alertas" className="flex min-w-fit items-center gap-2 whitespace-nowrap">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Config. Alertas</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alertas">
            <Card className="p-6">
              <AlertasPonto />
            </Card>
          </TabsContent>

          <TabsContent value="individual">
            <Card className="p-6">
              <LancamentoPonto />
            </Card>
          </TabsContent>

          <TabsContent value="lote">
            <Card className="p-6">
              <LancamentoPontoLote />
            </Card>
          </TabsContent>

          <TabsContent value="configuracao">
            <Card className="p-6">
              <ConfiguracaoHoras />
            </Card>
          </TabsContent>

          <TabsContent value="relatorios">
            <Card className="p-6">
              <RelatoriosPonto />
            </Card>
          </TabsContent>

          <TabsContent value="banco">
            <Card className="p-6">
              <BancoHoras />
            </Card>
          </TabsContent>

          <TabsContent value="etiquetas">
            <Card className="p-6">
              <EtiquetasPonto />
            </Card>
          </TabsContent>

          <TabsContent value="config-alertas">
            <Card className="p-6">
              <ConfiguracaoAlertasPonto />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

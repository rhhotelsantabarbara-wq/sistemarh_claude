import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FileText } from "lucide-react";
import EpiStockList from "@/components/stock/EpiStockList";
import UniformStockList from "@/components/stock/UniformStockList";
import EpiStockForm from "@/components/stock/EpiStockForm";
import UniformStockForm from "@/components/stock/UniformStockForm";
import EpiDistributionHistory from "@/components/stock/EpiDistributionHistory";
import UniformDistributionHistory from "@/components/stock/UniformDistributionHistory";
import EpiStockHistory from "@/components/stock/EpiStockHistory";
import UniformStockHistory from "@/components/stock/UniformStockHistory";
import UniformDistributionBatch from "@/components/stock/UniformDistributionBatch";
import ImportNfeDialog from "@/components/stock/ImportNfeDialog";

const Stock = () => {
  const [showEpiDialog, setShowEpiDialog] = useState(false);
  const [showUniformDialog, setShowUniformDialog] = useState(false);
  const [showNfeDialog, setShowNfeDialog] = useState(false);
  const [refreshEpi, setRefreshEpi] = useState(0);
  const [refreshUniform, setRefreshUniform] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gerenciamento de Estoque</h1>
        <Button variant="outline" onClick={() => setShowNfeDialog(true)}>
          <FileText className="w-4 h-4 mr-2" />
          Importar NF-e
        </Button>
      </div>

      <Tabs defaultValue="epis" className="w-full">
        <div className="overflow-x-auto tabs-scroll">
          <TabsList className="inline-flex w-auto min-w-full">
            <TabsTrigger value="epis" className="whitespace-nowrap">Estoque EPIs</TabsTrigger>
            <TabsTrigger value="uniformes" className="whitespace-nowrap">Estoque Uniformes</TabsTrigger>
            <TabsTrigger value="distribuicao-lote" className="whitespace-nowrap">Distribuição em Lote</TabsTrigger>
            <TabsTrigger value="movimentacao-epis" className="whitespace-nowrap">Mov. EPIs</TabsTrigger>
            <TabsTrigger value="movimentacao-uniformes" className="whitespace-nowrap">Mov. Uniformes</TabsTrigger>
            <TabsTrigger value="historico-epis" className="whitespace-nowrap">Dist. EPIs</TabsTrigger>
            <TabsTrigger value="historico-uniformes" className="whitespace-nowrap">Dist. Uniformes</TabsTrigger>
          </TabsList>
        </div>

          <TabsContent value="epis" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showEpiDialog} onOpenChange={setShowEpiDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar EPI
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Cadastrar EPI no Estoque</DialogTitle>
                  </DialogHeader>
                  <EpiStockForm
                    onSaved={() => {
                      setShowEpiDialog(false);
                      setRefreshEpi(prev => prev + 1);
                    }}
                    onCancel={() => setShowEpiDialog(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
            <EpiStockList key={refreshEpi} />
          </TabsContent>

          <TabsContent value="uniformes" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showUniformDialog} onOpenChange={setShowUniformDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Uniforme
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Cadastrar Uniforme no Estoque</DialogTitle>
                  </DialogHeader>
                  <UniformStockForm
                    onSaved={() => {
                      setShowUniformDialog(false);
                      setRefreshUniform(prev => prev + 1);
                    }}
                    onCancel={() => setShowUniformDialog(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
            <UniformStockList key={refreshUniform} />
          </TabsContent>

          <TabsContent value="distribuicao-lote" className="space-y-4">
            <UniformDistributionBatch />
          </TabsContent>

          <TabsContent value="movimentacao-epis" className="space-y-4">
            <EpiStockHistory />
          </TabsContent>

          <TabsContent value="movimentacao-uniformes" className="space-y-4">
            <UniformStockHistory />
          </TabsContent>

          <TabsContent value="historico-epis" className="space-y-4">
            <EpiDistributionHistory />
          </TabsContent>

          <TabsContent value="historico-uniformes" className="space-y-4">
            <UniformDistributionHistory />
          </TabsContent>
      </Tabs>

      <ImportNfeDialog
        open={showNfeDialog}
        onOpenChange={setShowNfeDialog}
        onImported={() => {
          setRefreshEpi(prev => prev + 1);
          setRefreshUniform(prev => prev + 1);
        }}
      />
    </div>
  );
};

export default Stock;

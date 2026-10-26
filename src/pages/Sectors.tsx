import { SectorForm } from "@/components/sectors/SectorForm";
import { SectorList } from "@/components/sectors/SectorList";
import { SectorWorkforceConfig } from "@/components/sectors/SectorWorkforceConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Settings, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Sectors() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-0 sm:p-2 lg:p-4 max-w-6xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/dashboard")}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar
      </Button>
      <h1 className="text-3xl font-bold mb-6">Gerenciamento de Setores</h1>
      
      <Tabs defaultValue="setores" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="setores" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Setores
          </TabsTrigger>
          <TabsTrigger value="configuracao" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuração de Quantidade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setores">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Cadastrar Setor</CardTitle>
                <CardDescription>
                  Adicione um novo setor para organizar seus funcionários
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SectorForm />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Setores Cadastrados</CardTitle>
                <CardDescription>
                  Lista de todos os setores disponíveis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SectorList />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="configuracao">
          <SectorWorkforceConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
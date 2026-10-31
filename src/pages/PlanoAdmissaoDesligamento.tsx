import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ChecklistsEmAndamento } from "@/components/plano-checklist/ChecklistsEmAndamento";
import { TemplatesConfig } from "@/components/plano-checklist/TemplatesConfig";

export default function PlanoAdmissaoDesligamento() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("admissoes");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-medium leading-tight">Plano de Admissão e Desligamento</h1>
          <p className="text-muted-foreground">
            Gerencie checklists de onboarding e offboarding de funcionários
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="inline-flex w-full overflow-x-auto tabs-scroll">
          <TabsTrigger value="admissoes" className="flex-shrink-0 whitespace-nowrap">Admissões em Andamento</TabsTrigger>
          <TabsTrigger value="desligamentos" className="flex-shrink-0 whitespace-nowrap">Desligamentos em Andamento</TabsTrigger>
          <TabsTrigger value="templates" className="flex-shrink-0 whitespace-nowrap">Configurar Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="admissoes" className="mt-6">
          <ChecklistsEmAndamento tipo="admissao" />
        </TabsContent>

        <TabsContent value="desligamentos" className="mt-6">
          <ChecklistsEmAndamento tipo="desligamento" />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <TemplatesConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}

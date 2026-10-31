import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CursosList } from "@/components/treinamentos/CursosList";
import { RelatoriosTreinamento } from "@/components/treinamentos/RelatoriosTreinamento";
import { EstatisticasTreinamento } from "@/components/treinamentos/EstatisticasTreinamento";

export default function Treinamentos() {
  return (
    <div className="container mx-auto p-0 sm:p-2 lg:p-4 space-y-6">
      <div>
        <h1 className="text-xl font-medium leading-tight">Sistema de Treinamentos</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie cursos, módulos, aulas e acompanhe o progresso dos funcionários
        </p>
      </div>

      <Tabs defaultValue="cursos" className="w-full">
        <TabsList className="inline-flex w-full overflow-x-auto tabs-scroll">
          <TabsTrigger value="cursos" className="flex-shrink-0 whitespace-nowrap">Cursos</TabsTrigger>
          <TabsTrigger value="relatorios" className="flex-shrink-0 whitespace-nowrap">Relatórios</TabsTrigger>
          <TabsTrigger value="estatisticas" className="flex-shrink-0 whitespace-nowrap">Estatísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="cursos" className="mt-6">
          <CursosList />
        </TabsContent>

        <TabsContent value="relatorios" className="mt-6">
          <RelatoriosTreinamento />
        </TabsContent>

        <TabsContent value="estatisticas" className="mt-6">
          <EstatisticasTreinamento />
        </TabsContent>
      </Tabs>
    </div>
  );
}

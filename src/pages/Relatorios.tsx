import { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  FileText,
  Package,
  Briefcase,
  BarChart3,
} from "lucide-react";
import EmployeeReports from "@/components/relatorios/reports/EmployeeReports";
import AttendanceReports from "@/components/relatorios/reports/AttendanceReports";
import StockReports from "@/components/relatorios/reports/StockReports";
import RecruitmentReports from "@/components/relatorios/reports/RecruitmentReports";

const Relatorios = () => {
  const [activeTab, setActiveTab] = useState("employees");

  return (
    <div className="space-y-6">
      <PageHeader titulo="Central de relatórios" descricao="Gere e exporte relatórios de colaboradores, frequência, estoque e recrutamento" icone={BarChart3} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="inline-flex w-full overflow-x-auto tabs-scroll">
          <TabsTrigger
            value="employees"
            className="flex items-center gap-2 flex-shrink-0 min-w-fit"
          >
            <Users className="w-4 h-4" />
            Funcionários
          </TabsTrigger>
          <TabsTrigger
            value="attendance"
            className="flex items-center gap-2 flex-shrink-0 min-w-fit"
          >
            <FileText className="w-4 h-4" />
            Frequência
          </TabsTrigger>
          <TabsTrigger
            value="stock"
            className="flex items-center gap-2 flex-shrink-0 min-w-fit"
          >
            <Package className="w-4 h-4" />
            EPIs/Uniformes
          </TabsTrigger>
          <TabsTrigger
            value="recruitment"
            className="flex items-center gap-2 flex-shrink-0 min-w-fit"
          >
            <Briefcase className="w-4 h-4" />
            Recrutamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <EmployeeReports />
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceReports />
        </TabsContent>

        <TabsContent value="stock">
          <StockReports />
        </TabsContent>

        <TabsContent value="recruitment">
          <RecruitmentReports />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Relatorios;

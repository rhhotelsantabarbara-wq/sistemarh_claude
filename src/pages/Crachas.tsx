import CrachaEmployeeList from "@/components/crachas/CrachaEmployeeList";
import { IdCard } from "lucide-react";

const Crachas = () => {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center gap-3 mb-6">
        <IdCard className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-xl font-medium leading-tight">Impressão de Crachás</h1>
          <p className="text-muted-foreground">
            Selecione os funcionários e gere um PDF com os crachás
          </p>
        </div>
      </div>
      <CrachaEmployeeList />
    </div>
  );
};

export default Crachas;

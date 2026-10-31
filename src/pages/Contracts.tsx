import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ContractTemplateList } from "@/components/contracts/ContractTemplateList";

const Contracts = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-medium leading-tight text-foreground">Contratos</h1>
            <p className="text-muted-foreground">
              Configure modelos de contrato para cada função
            </p>
          </div>
        </div>

        <ContractTemplateList />
      </div>
    </div>
  );
};

export default Contracts;

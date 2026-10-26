import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CompanyList from "@/components/companies/CompanyList";

export default function Companies() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background sm:p-2 lg:p-4">
      <div className="max-w-7xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <CompanyList />
      </div>
    </div>
  );
}

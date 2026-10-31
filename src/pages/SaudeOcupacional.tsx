import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DashboardMetrics } from "@/components/saude-ocupacional/DashboardMetrics";
import { EncaminhamentosList } from "@/components/saude-ocupacional/EncaminhamentosList";
import { EncaminhamentoForm } from "@/components/saude-ocupacional/EncaminhamentoForm";

const SaudeOcupacional = () => {
  const navigate = useNavigate();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => {
    setShowNewDialog(false);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="">
      <div className="space-y-6">
        <div className="mb-6 flex items-center justify-between">
          
          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Encaminhamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo Encaminhamento Médico</DialogTitle>
              </DialogHeader>
              <EncaminhamentoForm
                onSaved={handleSaved}
                onCancel={() => setShowNewDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-8">
          <h1 className="text-xl font-medium leading-tight mb-2">Saúde Ocupacional</h1>
          <p className="text-muted-foreground">
            Gerencie encaminhamentos para exames médicos ocupacionais
          </p>
        </div>

        <DashboardMetrics key={refreshKey} />

        <div className="mt-8">
          <EncaminhamentosList key={refreshKey} />
        </div>
      </div>
    </div>
  );
};

export default SaudeOcupacional;

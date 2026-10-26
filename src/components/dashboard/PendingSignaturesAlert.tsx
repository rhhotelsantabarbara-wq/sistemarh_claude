import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PenTool } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SignatureCanvas from "../forms/SignatureCanvas";
import { toast } from "sonner";
import { dataBR } from "@/lib/date";

interface PendingItem {
  id: string;
  tipo: "epi" | "uniforme";
  tipo_epi?: string;
  tipo_uniforme?: string;
  data_entrega: string;
}

const PendingSignaturesAlert = () => {
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [currentItem, setCurrentItem] = useState<PendingItem | null>(null);

  const fetchPendingSignatures = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get employee ID
    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!employee) return;

    // Fetch unsigned EPIs
    const { data: epis } = await supabase
      .from("epis")
      .select("id, tipo_epi, data_entrega")
      .eq("employee_id", employee.id)
      .is("assinatura_funcionario", null);

    // Fetch unsigned Uniforms
    const { data: uniformes } = await supabase
      .from("uniformes")
      .select("id, tipo_uniforme, data_entrega")
      .eq("employee_id", employee.id)
      .is("assinatura_funcionario", null);

    const pending: PendingItem[] = [
      ...(epis || []).map(epi => ({ ...epi, tipo: "epi" as const })),
      ...(uniformes || []).map(uniforme => ({ ...uniforme, tipo: "uniforme" as const })),
    ];

    setPendingItems(pending);
  };

  useEffect(() => {
    fetchPendingSignatures();
  }, []);

  const handleSignItem = (item: PendingItem) => {
    setCurrentItem(item);
    setShowSignatureDialog(true);
  };

  const handleSaveSignature = async (signatureData: string) => {
    if (!currentItem) return;

    const table = currentItem.tipo === "epi" ? "epis" : "uniformes";
    
    const { error } = await supabase
      .from(table)
      .update({
        assinatura_funcionario: signatureData,
        data_assinatura: new Date().toISOString(),
      })
      .eq("id", currentItem.id);

    if (error) {
      toast.error("Erro ao salvar assinatura");
      return;
    }

    toast.success("Assinatura salva com sucesso!");
    setShowSignatureDialog(false);
    setCurrentItem(null);
    fetchPendingSignatures();
  };

  if (pendingItems.length === 0) return null;

  return (
    <>
      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assinar Recebimento</DialogTitle>
          </DialogHeader>
          <SignatureCanvas
            onSave={handleSaveSignature}
            onCancel={() => setShowSignatureDialog(false)}
            title={`Assinar recebimento de ${currentItem?.tipo === "epi" ? currentItem.tipo_epi : currentItem?.tipo_uniforme}`}
          />
        </DialogContent>
      </Dialog>

      <Alert className="bg-yellow-50 border-yellow-200">
        <PenTool className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-800">Assinaturas Pendentes</AlertTitle>
        <AlertDescription className="text-yellow-700">
          Você possui {pendingItems.length} {pendingItems.length === 1 ? "item pendente" : "itens pendentes"} de assinatura.
          <div className="mt-3 space-y-2">
            {pendingItems.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-white p-2 rounded">
                <span className="text-sm">
                  {item.tipo === "epi" ? `EPI: ${item.tipo_epi}` : `Uniforme: ${item.tipo_uniforme}`}
                  {" "}(entregue em {dataBR(item.data_entrega).toLocaleDateString("pt-BR")})
                </span>
                <Button
                  size="sm"
                  onClick={() => handleSignItem(item)}
                  className="ml-2"
                >
                  <PenTool className="w-3 h-3 mr-1" />
                  Assinar
                </Button>
              </div>
            ))}
          </div>
        </AlertDescription>
      </Alert>
    </>
  );
};

export default PendingSignaturesAlert;

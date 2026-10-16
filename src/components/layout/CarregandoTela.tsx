import { Loader2 } from "lucide-react";

export default function CarregandoTela({ telaCheia = false }: { telaCheia?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${telaCheia ? "min-h-screen" : "h-64"}`}>
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

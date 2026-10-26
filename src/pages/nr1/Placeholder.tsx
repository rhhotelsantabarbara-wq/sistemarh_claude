import { Card } from "@/components/ui/card";

export default function NR1Placeholder({ titulo }: { titulo: string }) {
  return (
    <div className="container mx-auto p-0 sm:p-2 lg:p-4">
      <h1 className="text-3xl font-bold">{titulo}</h1>
      <Card className="p-12 mt-6 text-center shadow-elegant">
        <p className="text-muted-foreground">Em desenvolvimento — disponível em breve nas próximas fases do módulo NR-1.</p>
      </Card>
    </div>
  );
}

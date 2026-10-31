import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";

export default function NR1Config() {
  const [cfg, setCfg] = useState<any>(null);

  const load = async () => {
    const { data } = await (supabase.from("nr1_config") as any).select("*").limit(1).maybeSingle();
    setCfg(data);
  };
  useEffect(() => { load(); }, []);

  const salvar = async () => {
    if (!cfg) return;
    const { error } = await (supabase.from("nr1_config") as any).update({
      alerta_denuncias_qtd: Number(cfg.alerta_denuncias_qtd),
      clima_score_minimo: Number(cfg.clima_score_minimo),
      alerta_lideranca_score: Number(cfg.alerta_lideranca_score),
      reciclagem_padrao_meses: Number(cfg.reciclagem_padrao_meses),
      observacoes: cfg.observacoes || null,
    }).eq("id", cfg.id);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
  };

  if (!cfg) return <div className="p-6">Carregando...</div>;

  return (
    <div className="container mx-auto p-0 sm:p-2 lg:p-4 max-w-3xl space-y-6">
      <div className="flex items-center gap-3"><Settings2 className="h-5 w-5 text-primary" /><h1 className="text-xl font-medium leading-tight">Configurações NR-1</h1></div>

      <Card className="p-6 space-y-4 shadow-elegant">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Alerta: nº de denúncias abertas</Label>
            <Input type="number" value={cfg.alerta_denuncias_qtd} onChange={(e) => setCfg({ ...cfg, alerta_denuncias_qtd: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">Acima deste número, gera alerta no Dashboard.</p>
          </div>
          <div>
            <Label>Score mínimo de clima (0-10)</Label>
            <Input type="number" step="0.1" value={cfg.clima_score_minimo} onChange={(e) => setCfg({ ...cfg, clima_score_minimo: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">Abaixo deste valor, gera alerta crítico.</p>
          </div>
          <div>
            <Label>Score mínimo de liderança (0-10)</Label>
            <Input type="number" step="0.1" value={cfg.alerta_lideranca_score} onChange={(e) => setCfg({ ...cfg, alerta_lideranca_score: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">Identifica liderança tóxica.</p>
          </div>
          <div>
            <Label>Reciclagem padrão (meses)</Label>
            <Input type="number" value={cfg.reciclagem_padrao_meses} onChange={(e) => setCfg({ ...cfg, reciclagem_padrao_meses: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">Periodicidade padrão dos treinamentos.</p>
          </div>
        </div>
        <div>
          <Label>Observações internas</Label>
          <Textarea value={cfg.observacoes || ""} onChange={(e) => setCfg({ ...cfg, observacoes: e.target.value })} />
        </div>
        <Button onClick={salvar}>Salvar</Button>
      </Card>
    </div>
  );
}

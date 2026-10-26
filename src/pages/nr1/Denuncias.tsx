import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NovaDenunciaForm } from "@/components/nr1/denuncias/NovaDenunciaForm";
import { DenunciaDetailsDialog } from "@/components/nr1/denuncias/DenunciaDetailsDialog";
import { CATEGORIAS_DENUNCIA, STATUS_DENUNCIA } from "@/lib/nr1/perguntasPadrao";
import { Megaphone } from "lucide-react";
import { dataBR } from "@/lib/date";

export default function NR1Denuncias() {
  const [denuncias, setDenuncias] = useState<any[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [selecionada, setSelecionada] = useState<any | null>(null);

  const load = async () => {
    const { data } = await (supabase.from("nr1_denuncias") as any).select("*").order("created_at", { ascending: false });
    setDenuncias(data || []);
  };

  useEffect(() => { load(); }, []);

  const filtradas = denuncias.filter((d) => {
    if (filtroStatus !== "todos" && d.status !== filtroStatus) return false;
    if (filtroCategoria !== "todos" && d.categoria !== filtroCategoria) return false;
    if (busca && !d.protocolo.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  const labelCat = (v: string) => CATEGORIAS_DENUNCIA.find((c) => c.value === v)?.label || v;
  const statusInfo = (v: string) => STATUS_DENUNCIA.find((s) => s.value === v);

  return (
    <div className="container mx-auto p-0 sm:p-2 lg:p-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Megaphone className="w-7 h-7 text-primary" />
          Canal de Denúncias
        </h1>
        <p className="text-muted-foreground mt-2">Canal anônimo seguro e área administrativa de apuração</p>
      </div>

      <Tabs defaultValue="apuracao">
        <TabsList className="grid grid-cols-2 max-w-md">
          <TabsTrigger value="apuracao">Apuração (RH)</TabsTrigger>
          <TabsTrigger value="nova">Nova denúncia</TabsTrigger>
        </TabsList>

        <TabsContent value="apuracao" className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-3">
            <Input placeholder="Buscar por protocolo..." value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs" />
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {STATUS_DENUNCIA.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as categorias</SelectItem>
                {CATEGORIAS_DENUNCIA.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card className="shadow-elegant">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recebida</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((d) => {
                  const si = statusInfo(d.status);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.protocolo}</TableCell>
                      <TableCell>{labelCat(d.categoria)}</TableCell>
                      <TableCell>{d.setor || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={si?.color}>{si?.label}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{dataBR(d.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell><Button size="sm" variant="outline" onClick={() => setSelecionada(d)}>Detalhes</Button></TableCell>
                    </TableRow>
                  );
                })}
                {filtradas.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma denúncia encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="nova" className="mt-6">
          <NovaDenunciaForm onSuccess={load} />
        </TabsContent>
      </Tabs>

      {selecionada && (
        <DenunciaDetailsDialog
          denuncia={selecionada}
          open={!!selecionada}
          onOpenChange={(o) => !o && setSelecionada(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}

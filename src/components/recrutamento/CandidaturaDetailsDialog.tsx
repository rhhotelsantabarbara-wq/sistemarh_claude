import { useState, useEffect } from "react";
import { parseDateOnly, dataBR } from "@/lib/date";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Download, Calendar, User } from "lucide-react";

interface CandidaturaDetailsDialogProps {
  candidaturaId: string;
  onClose: () => void;
}

export default function CandidaturaDetailsDialog({
  candidaturaId,
  onClose,
}: CandidaturaDetailsDialogProps) {
  const [candidatura, setCandidatura] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [avaliacao, setAvaliacao] = useState("");
  const [nota, setNota] = useState<number>(0);
  const [dataEntrevista, setDataEntrevista] = useState("");
  const [motivoReprovacao, setMotivoReprovacao] = useState("");

  useEffect(() => {
    fetchCandidatura();
  }, [candidaturaId]);

  const fetchCandidatura = async () => {
    try {
      const { data, error } = await supabase
        .from("candidaturas")
        .select("*")
        .eq("id", candidaturaId)
        .single();

      if (error) throw error;
      setCandidatura(data);
      setAvaliacao(data.avaliacao_gestor || "");
      setNota(data.nota_avaliacao || 0);
      setDataEntrevista(data.data_entrevista || "");
    } catch (error) {
      console.error("Erro ao buscar candidatura:", error);
      toast.error("Erro ao carregar candidatura");
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      const updateData: any = { status: newStatus };

      if (newStatus === "entrevista_agendada" && dataEntrevista) {
        updateData.data_entrevista = dataEntrevista;
      }

      if (newStatus === "reprovada" && motivoReprovacao) {
        updateData.motivo_reprovacao = motivoReprovacao;
      }

      if (avaliacao) {
        updateData.avaliacao_gestor = avaliacao;
        updateData.data_avaliacao = new Date().toISOString();
      }

      if (nota > 0) {
        updateData.nota_avaliacao = nota;
      }

      const { error } = await supabase
        .from("candidaturas")
        .update(updateData)
        .eq("id", candidaturaId);

      if (error) throw error;
      toast.success("Status atualizado com sucesso!");
      onClose();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    } finally {
      setLoading(false);
    }
  };

  if (!candidatura) return null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Candidatura de {candidatura.nome_completo}</span>
            <Badge>{candidatura.status}</Badge>
          </DialogTitle>
          <DialogDescription>
            Candidatura realizada em {dataBR(candidatura.data_candidatura).toLocaleDateString('pt-BR')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>E-mail</Label>
              <p className="text-sm text-muted-foreground">{candidatura.email}</p>
            </div>
            <div>
              <Label>Telefone</Label>
              <p className="text-sm text-muted-foreground">{candidatura.telefone}</p>
            </div>
            <div>
              <Label>CPF</Label>
              <p className="text-sm text-muted-foreground">{candidatura.cpf}</p>
            </div>
            <div>
              <Label>Data de Nascimento</Label>
              <p className="text-sm text-muted-foreground">
                {(parseDateOnly(candidatura.data_nascimento) ?? new Date()).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>

          {candidatura.endereco && (
            <div>
              <Label>Endereço</Label>
              <p className="text-sm text-muted-foreground">{candidatura.endereco}</p>
            </div>
          )}

          {candidatura.curriculum_url && (
            <div>
              <Label>Currículo</Label>
              <Button variant="outline" size="sm" asChild className="mt-2">
                <a href={candidatura.curriculum_url} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Baixar Currículo
                </a>
              </Button>
            </div>
          )}

          {candidatura.carta_apresentacao && (
            <div>
              <Label>Carta de Apresentação</Label>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-2">
                {candidatura.carta_apresentacao}
              </p>
            </div>
          )}

          {candidatura.experiencia_resumo && (
            <div>
              <Label>Experiência</Label>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-2">
                {candidatura.experiencia_resumo}
              </p>
            </div>
          )}

          <div>
            <Label>Avaliação do Gestor</Label>
            <Textarea
              value={avaliacao}
              onChange={(e) => setAvaliacao(e.target.value)}
              rows={3}
              className="mt-2"
              placeholder="Adicione sua avaliação..."
            />
          </div>

          <div>
            <Label>Nota (1-5)</Label>
            <div className="flex gap-2 mt-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNota(n)}
                  className="focus:outline-none"
                >
                  <Star
                    className={`h-6 w-6 ${
                      n <= nota ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {candidatura.status !== "entrevista_agendada" && (
            <div>
              <Label>Agendar Entrevista</Label>
              <Input
                type="datetime-local"
                value={dataEntrevista}
                onChange={(e) => setDataEntrevista(e.target.value)}
                className="mt-2"
              />
            </div>
          )}

          {candidatura.data_entrevista && (
            <div>
              <Label>Entrevista Agendada</Label>
              <p className="text-sm text-muted-foreground">
                {dataBR(candidatura.data_entrevista).toLocaleString('pt-BR')}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {candidatura.status === "nova" && (
              <Button
                onClick={() => handleUpdateStatus("em_analise")}
                disabled={loading}
              >
                Marcar como Em Análise
              </Button>
            )}

            {candidatura.status !== "entrevista_agendada" && dataEntrevista && (
              <Button
                onClick={() => handleUpdateStatus("entrevista_agendada")}
                disabled={loading}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Agendar Entrevista
              </Button>
            )}

            {candidatura.status !== "aprovada" && (
              <Button
                onClick={() => handleUpdateStatus("aprovada")}
                disabled={loading}
                variant="default"
              >
                Aprovar
              </Button>
            )}

            {candidatura.status !== "reprovada" && (
              <>
                <div className="w-full">
                  <Label>Motivo da Reprovação</Label>
                  <Textarea
                    value={motivoReprovacao}
                    onChange={(e) => setMotivoReprovacao(e.target.value)}
                    rows={2}
                    className="mt-2"
                    placeholder="Descreva o motivo (opcional)..."
                  />
                </div>
                <Button
                  onClick={() => handleUpdateStatus("reprovada")}
                  disabled={loading}
                  variant="destructive"
                >
                  Reprovar
                </Button>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

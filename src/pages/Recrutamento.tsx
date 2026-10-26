import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Briefcase, Users, Clock, CheckCircle, ArrowLeft } from "lucide-react";
import VagaForm from "@/components/recrutamento/VagaForm";
import { useNavigate } from "react-router-dom";

interface Vaga {
  id: string;
  titulo: string;
  status: string;
  quantidade_vagas: number;
  created_at: string;
  empresas: { nome: string } | null;
  candidaturas: { count: number }[];
}

export default function Recrutamento() {
  const navigate = useNavigate();
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingVaga, setEditingVaga] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    abertas: 0,
    candidaturas: 0,
    novas: 0,
  });

  useEffect(() => {
    fetchVagas();
    fetchStats();
  }, []);

  const fetchVagas = async () => {
    try {
      const { data, error } = await supabase
        .from("vagas")
        .select(`
          *,
          empresas:empresa_id(nome),
          candidaturas(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVagas(data || []);
    } catch (error) {
      console.error("Erro ao buscar vagas:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { count: abertas } = await supabase
        .from("vagas")
        .select("*", { count: "exact", head: true })
        .eq("status", "aberta");

      const { count: candidaturas } = await supabase
        .from("candidaturas")
        .select("*", { count: "exact", head: true });

      const { count: novas } = await supabase
        .from("candidaturas")
        .select("*", { count: "exact", head: true })
        .eq("status", "nova");

      setStats({
        abertas: abertas || 0,
        candidaturas: candidaturas || 0,
        novas: novas || 0,
      });
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
    }
  };

  const handleStatusChange = async (vagaId: string, newStatus: "aberta" | "pausada" | "fechada") => {
    try {
      const { error } = await supabase
        .from("vagas")
        .update({ status: newStatus })
        .eq("id", vagaId);

      if (error) throw error;
      fetchVagas();
      fetchStats();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  if (showForm || editingVaga) {
    return (
      <div className="container mx-auto px-4 py-8">
        <VagaForm
          vagaId={editingVaga}
          onClose={() => {
            setShowForm(false);
            setEditingVaga(null);
            fetchVagas();
            fetchStats();
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Button
        variant="ghost"
        onClick={() => navigate("/dashboard")}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar
      </Button>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Recrutamento e Seleção</h1>
          <p className="text-muted-foreground mt-2">Gerencie vagas e candidaturas</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Vaga
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vagas Abertas</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.abertas}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Candidaturas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.candidaturas}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Candidaturas Novas</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.novas}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="abertas">
        <TabsList>
          <TabsTrigger value="abertas">Abertas</TabsTrigger>
          <TabsTrigger value="pausadas">Pausadas</TabsTrigger>
          <TabsTrigger value="fechadas">Fechadas</TabsTrigger>
        </TabsList>

        <TabsContent value="abertas" className="mt-6">
          <div className="grid gap-4">
            {vagas
              .filter((v) => v.status === "aberta")
              .map((vaga) => (
                <VagaCard
                  key={vaga.id}
                  vaga={vaga}
                  onEdit={() => setEditingVaga(vaga.id)}
                  onStatusChange={handleStatusChange}
                  onViewCandidaturas={() => navigate(`/recrutamento/vaga/${vaga.id}/candidaturas`)}
                />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="pausadas" className="mt-6">
          <div className="grid gap-4">
            {vagas
              .filter((v) => v.status === "pausada")
              .map((vaga) => (
                <VagaCard
                  key={vaga.id}
                  vaga={vaga}
                  onEdit={() => setEditingVaga(vaga.id)}
                  onStatusChange={handleStatusChange}
                  onViewCandidaturas={() => navigate(`/recrutamento/vaga/${vaga.id}/candidaturas`)}
                />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="fechadas" className="mt-6">
          <div className="grid gap-4">
            {vagas
              .filter((v) => v.status === "fechada")
              .map((vaga) => (
                <VagaCard
                  key={vaga.id}
                  vaga={vaga}
                  onEdit={() => setEditingVaga(vaga.id)}
                  onStatusChange={handleStatusChange}
                  onViewCandidaturas={() => navigate(`/recrutamento/vaga/${vaga.id}/candidaturas`)}
                />
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface VagaCardProps {
  vaga: Vaga;
  onEdit: () => void;
  onStatusChange: (id: string, status: string) => void;
  onViewCandidaturas: () => void;
}

function VagaCard({ vaga, onEdit, onStatusChange, onViewCandidaturas }: VagaCardProps) {
  const candidaturasCount = vaga.candidaturas?.[0]?.count || 0;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <CardTitle>{vaga.titulo}</CardTitle>
            <CardDescription className="mt-2">
              {vaga.empresas?.nome} • {vaga.quantidade_vagas} vaga(s)
            </CardDescription>
          </div>
          <Badge variant={vaga.status === "aberta" ? "default" : "secondary"}>
            {vaga.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{candidaturasCount} candidatura(s)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onViewCandidaturas}>
              Ver Candidaturas
            </Button>
            <Button variant="outline" size="sm" onClick={onEdit}>
              Editar
            </Button>
            {vaga.status === "aberta" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange(vaga.id, "pausada")}
              >
                Pausar
              </Button>
            )}
            {vaga.status === "pausada" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange(vaga.id, "aberta")}
              >
                Reabrir
              </Button>
            )}
            {vaga.status !== "fechada" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange(vaga.id, "fechada")}
              >
                Fechar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

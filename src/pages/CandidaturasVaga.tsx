import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Mail, Phone, Calendar, Star } from "lucide-react";
import CandidaturaDetailsDialog from "@/components/recrutamento/CandidaturaDetailsDialog";
import { dataBR } from "@/lib/date";

interface Candidatura {
  id: string;
  nome_completo: string;
  email: string;
  telefone: string;
  status: string;
  data_candidatura: string;
  nota_avaliacao: number | null;
}

export default function CandidaturasVaga() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [candidaturas, setCandidaturas] = useState<Candidatura[]>([]);
  const [vaga, setVaga] = useState<any>(null);
  const [selectedCandidatura, setSelectedCandidatura] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVaga();
    fetchCandidaturas();
  }, [id]);

  const fetchVaga = async () => {
    try {
      const { data, error } = await supabase
        .from("vagas")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setVaga(data);
    } catch (error) {
      console.error("Erro ao buscar vaga:", error);
    }
  };

  const fetchCandidaturas = async () => {
    try {
      const { data, error } = await supabase
        .from("candidaturas")
        .select("*")
        .eq("vaga_id", id)
        .order("data_candidatura", { ascending: false });

      if (error) throw error;
      setCandidaturas(data || []);
    } catch (error) {
      console.error("Erro ao buscar candidaturas:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      nova: "default",
      em_analise: "secondary",
      entrevista_agendada: "outline",
      aprovada: "default",
      reprovada: "destructive",
      contratada: "default",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  if (loading) {
    return <div className="space-y-6">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate("/recrutamento")} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para Vagas
      </Button>

      {vaga && (
        <div className="mb-8">
          <h1 className="text-xl font-medium leading-tight">{vaga.titulo}</h1>
          <p className="text-muted-foreground mt-2">
            {candidaturas.length} candidatura(s) recebida(s)
          </p>
        </div>
      )}

      <Tabs defaultValue="todas">
        <TabsList>
          <TabsTrigger value="todas">
            Todas ({candidaturas.length})
          </TabsTrigger>
          <TabsTrigger value="novas">
            Novas ({candidaturas.filter((c) => c.status === "nova").length})
          </TabsTrigger>
          <TabsTrigger value="em_analise">
            Em Análise ({candidaturas.filter((c) => c.status === "em_analise").length})
          </TabsTrigger>
          <TabsTrigger value="aprovadas">
            Aprovadas ({candidaturas.filter((c) => c.status === "aprovada").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todas" className="mt-6">
          <div className="grid gap-4">
            {candidaturas.map((candidatura) => (
              <CandidaturaCard
                key={candidatura.id}
                candidatura={candidatura}
                onView={() => setSelectedCandidatura(candidatura.id)}
                getStatusBadge={getStatusBadge}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="novas" className="mt-6">
          <div className="grid gap-4">
            {candidaturas
              .filter((c) => c.status === "nova")
              .map((candidatura) => (
                <CandidaturaCard
                  key={candidatura.id}
                  candidatura={candidatura}
                  onView={() => setSelectedCandidatura(candidatura.id)}
                  getStatusBadge={getStatusBadge}
                />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="em_analise" className="mt-6">
          <div className="grid gap-4">
            {candidaturas
              .filter((c) => c.status === "em_analise")
              .map((candidatura) => (
                <CandidaturaCard
                  key={candidatura.id}
                  candidatura={candidatura}
                  onView={() => setSelectedCandidatura(candidatura.id)}
                  getStatusBadge={getStatusBadge}
                />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="aprovadas" className="mt-6">
          <div className="grid gap-4">
            {candidaturas
              .filter((c) => c.status === "aprovada")
              .map((candidatura) => (
                <CandidaturaCard
                  key={candidatura.id}
                  candidatura={candidatura}
                  onView={() => setSelectedCandidatura(candidatura.id)}
                  getStatusBadge={getStatusBadge}
                />
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {selectedCandidatura && (
        <CandidaturaDetailsDialog
          candidaturaId={selectedCandidatura}
          onClose={() => {
            setSelectedCandidatura(null);
            fetchCandidaturas();
          }}
        />
      )}
    </div>
  );
}

interface CandidaturaCardProps {
  candidatura: Candidatura;
  onView: () => void;
  getStatusBadge: (status: string) => JSX.Element;
}

function CandidaturaCard({ candidatura, onView, getStatusBadge }: CandidaturaCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{candidatura.nome_completo}</CardTitle>
            <CardDescription className="mt-2 space-y-1">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>{candidatura.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>{candidatura.telefone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{dataBR(candidatura.data_candidatura).toLocaleDateString('pt-BR')}</span>
              </div>
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            {getStatusBadge(candidatura.status)}
            {candidatura.nota_avaliacao && (
              <div className="flex items-center gap-1">
                {[...Array(candidatura.nota_avaliacao)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button onClick={onView}>Ver Detalhes</Button>
      </CardContent>
    </Card>
  );
}

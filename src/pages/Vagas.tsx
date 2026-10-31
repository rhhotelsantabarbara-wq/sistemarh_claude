import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Briefcase, MapPin, DollarSign, Building2, Users, TrendingUp, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Vaga {
  id: string;
  titulo: string;
  descricao: string;
  tipo_contrato: string;
  tipo_salario: string;
  salario: number | null;
  exibir_salario: boolean;
  empresas: { nome: string } | null;
  setores: { nome: string } | null;
  quantidade_vagas: number | null;
}

export default function Vagas() {
  const navigate = useNavigate();
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [search, setSearch] = useState("");
  const [tipoContratoFilter, setTipoContratoFilter] = useState("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVagas();
  }, []);

  const fetchVagas = async () => {
    try {
      const { data, error } = await supabase
        .from("vagas")
        .select(`
          *,
          empresas:empresa_id(nome),
          setores:setor_id(nome)
        `)
        .eq("status", "aberta")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVagas(data || []);
    } catch (error) {
      console.error("Erro ao buscar vagas:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredVagas = vagas.filter((vaga) => {
    const matchSearch = vaga.titulo.toLowerCase().includes(search.toLowerCase()) ||
      vaga.descricao.toLowerCase().includes(search.toLowerCase());
    const matchTipo = tipoContratoFilter === "todos" || vaga.tipo_contrato === tipoContratoFilter;
    return matchSearch && matchTipo;
  });

  const tipoContratoLabel: Record<string, string> = {
    fixo: "Fixo",
    intermitente: "Intermitente",
    prestador_servico: "Prestador de Serviço"
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-card">
        <div className="absolute inset-0 bg-grid-white/10 bg-[size:20px_20px]" />
        <div className="container relative mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center space-y-6">
            <Badge variant="secondary" className="animate-fade-in">
              <Users className="h-3 w-3 mr-1" />
              Novas Oportunidades
            </Badge>
            <h1 className="text-3xl md:text-5xl font-medium tracking-tight text-foreground">
              Trabalhe Conosco
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground animate-fade-in max-w-2xl mx-auto">
              Encontre a oportunidade perfeita para você. Faça parte de uma equipe vencedora e desenvolva sua carreira profissional.
            </p>
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 animate-fade-in">
              <Card className="border-primary/20 hover-scale">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center gap-2">
                    <Briefcase className="h-8 w-8 text-primary" />
                    <div className="text-3xl font-bold">{vagas.length}</div>
                    <div className="text-sm text-muted-foreground">Vagas Abertas</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-secondary/20 hover-scale">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="h-8 w-8 text-secondary" />
                    <div className="text-3xl font-bold">{new Set(vagas.map(v => v.empresas?.nome)).size}</div>
                    <div className="text-sm text-muted-foreground">Empresas</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-accent/20 hover-scale">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center gap-2">
                    <TrendingUp className="h-8 w-8 text-accent" />
                    <div className="text-3xl font-bold">{vagas.reduce((sum, v) => sum + (v.quantidade_vagas || 1), 0)}</div>
                    <div className="text-sm text-muted-foreground">Posições</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Filters Section */}
      <section className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex gap-4 flex-col md:flex-row items-center">
            <div className="flex-1 relative w-full">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cargo, empresa ou palavra-chave..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <Select value={tipoContratoFilter} onValueChange={setTipoContratoFilter}>
              <SelectTrigger className="w-full md:w-[240px] h-11">
                <SelectValue placeholder="Tipo de contrato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os contratos</SelectItem>
                <SelectItem value="fixo">Fixo</SelectItem>
                <SelectItem value="intermitente">Intermitente</SelectItem>
                <SelectItem value="prestador_servico">Prestador de Serviço</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Vagas Section */}
      <section className="container mx-auto px-4 py-12">
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
            <p className="text-muted-foreground">Carregando oportunidades...</p>
          </div>
        ) : filteredVagas.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
              <Briefcase className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">Nenhuma vaga encontrada</h3>
            <p className="text-muted-foreground mb-6">
              {search || tipoContratoFilter !== "todos"
                ? "Tente ajustar os filtros para ver mais resultados"
                : "No momento não temos vagas disponíveis, mas volte em breve!"}
            </p>
            {(search || tipoContratoFilter !== "todos") && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setTipoContratoFilter("todos");
                }}
              >
                Limpar Filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">
                {filteredVagas.length} {filteredVagas.length === 1 ? "vaga disponível" : "vagas disponíveis"}
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredVagas.map((vaga, index) => (
                <Card
                  key={vaga.id}
                  className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-border/50 hover:border-primary/50 animate-fade-in overflow-hidden"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-primary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                  
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-xl group-hover:text-primary transition-colors line-clamp-2">
                        {vaga.titulo}
                      </CardTitle>
                      {vaga.quantidade_vagas && vaga.quantidade_vagas > 1 && (
                        <Badge variant="secondary" className="shrink-0">
                          {vaga.quantidade_vagas} vagas
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="w-fit">
                      {tipoContratoLabel[vaga.tipo_contrato] || vaga.tipo_contrato}
                    </Badge>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {vaga.empresas && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-4 w-4 shrink-0" />
                          <span className="truncate">{vaga.empresas.nome}</span>
                        </div>
                      )}
                      {vaga.setores && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 shrink-0" />
                          <span className="truncate">{vaga.setores.nome}</span>
                        </div>
                      )}
                      {vaga.exibir_salario && vaga.salario && (
                        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                          <DollarSign className="h-4 w-4 shrink-0" />
                          <span>R$ {vaga.salario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span className="text-xs text-muted-foreground font-normal">
                            /{vaga.tipo_salario === 'mensal' ? 'mês' : vaga.tipo_salario === 'diario' ? 'dia' : 'hora'}
                          </span>
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {vaga.descricao.replace(/<[^>]*>/g, '')}
                    </p>

                    <Button 
                      onClick={() => navigate(`/vaga/${vaga.id}`)} 
                      className="w-full group/btn"
                    >
                      Ver Detalhes
                      <ArrowRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Footer CTA */}
      {!loading && filteredVagas.length > 0 && (
        <section className="border-t bg-card py-16">
          <div className="container mx-auto px-4 text-center">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">Não encontrou a vaga ideal?</h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Novas oportunidades são publicadas regularmente. Volte em breve para conferir as próximas vagas!
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

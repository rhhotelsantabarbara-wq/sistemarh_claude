import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { VacationFiltersType } from "@/components/vacation-schedule/types";
import { Badge } from "@/components/ui/badge";

interface VacationFiltersProps {
  filters: VacationFiltersType;
  onFiltersChange: (filters: VacationFiltersType) => void;
}

export function VacationFilters({ filters, onFiltersChange }: VacationFiltersProps) {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [setores, setSetores] = useState<any[]>([]);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  useEffect(() => {
    fetchEmpresas();
    fetchSetores();
  }, []);

  const fetchEmpresas = async () => {
    const { data } = await supabase.from("empresas").select("*").order("nome");
    if (data) setEmpresas(data);
  };

  const fetchSetores = async () => {
    const { data } = await supabase.from("setores").select("*").order("nome");
    if (data) setSetores(data);
  };

  const handleReset = () => {
    onFiltersChange({
      empresa: "all",
      setor: "all",
      periodo: { start: null, end: null },
      status: "all",
      search: "",
      ano: undefined,
      feriasVencidas: false,
    });
  };

  const activeFiltersCount = [
    filters.empresa !== "all",
    filters.setor !== "all",
    filters.status !== "all",
    filters.search !== "",
    filters.ano !== undefined,
    filters.feriasVencidas === true,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Filtros</h3>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFiltersCount} ativo{activeFiltersCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <X className="h-4 w-4 mr-2" />
          Limpar Filtros
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="search">Buscar Funcionário</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Nome do funcionário..."
              value={filters.search}
              onChange={(e) =>
                onFiltersChange({ ...filters, search: e.target.value })
              }
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="empresa">Empresa</Label>
          <Select
            value={filters.empresa}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, empresa: value })
            }
          >
            <SelectTrigger id="empresa">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {empresas.map((empresa) => (
                <SelectItem key={empresa.id} value={empresa.id}>
                  {empresa.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="setor">Setor</Label>
          <Select
            value={filters.setor}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, setor: value })
            }
          >
            <SelectTrigger id="setor">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {setores.map((setor) => (
                <SelectItem key={setor.id} value={setor.nome}>
                  {setor.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={filters.status}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, status: value })
            }
          >
            <SelectTrigger id="status">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="planejado">Planejado</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ano">Ano</Label>
          <Select
            value={filters.ano?.toString() || "all"}
            onValueChange={(value) =>
              onFiltersChange({ 
                ...filters, 
                ano: value === "all" ? undefined : parseInt(value) 
              })
            }
          >
            <SelectTrigger id="ano">
              <SelectValue placeholder="Todos os anos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os anos</SelectItem>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

      </div>
    </div>
  );
}

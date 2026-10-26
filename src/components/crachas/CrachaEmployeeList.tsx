import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, Search, Users, Loader2, Settings2, RectangleHorizontal, RectangleVertical, Plus, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { generateBadgesPDF, BADGE_TEMPLATES, BadgeTemplate } from "@/lib/pdfGeneratorCrachas";
import { generateCustomBadgesPDF } from "@/lib/pdfGeneratorCrachasCustom";
import BadgeVisualEditor from "./BadgeVisualEditor";
import BadgeTemplateList from "./BadgeTemplateList";

interface CustomTemplate {
  id: string;
  nome: string;
  background_url: string | null;
  orientacao: string;
  largura: number;
  altura: number;
}

const CrachaEmployeeList = () => {
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState<string>("all");
  const [setorFilter, setSetorFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("ativo");
  const [isGenerating, setIsGenerating] = useState(false);

  // Badge options
  const [showCpf, setShowCpf] = useState(true);
  const [showSector, setShowSector] = useState(true);
  const [showCompanyLogo, setShowCompanyLogo] = useState(true);
  const [showPhoto, setShowPhoto] = useState(true);
  const [showCargo, setShowCargo] = useState(true);
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [selectedTemplate, setSelectedTemplate] = useState<BadgeTemplate>(BADGE_TEMPLATES[0]);
  const [customColor, setCustomColor] = useState<string>("");

  // Custom template state
  const [templateTab, setTemplateTab] = useState<"predefinido" | "personalizado">("predefinido");
  const [selectedCustomTemplate, setSelectedCustomTemplate] = useState<CustomTemplate | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | undefined>();
  const [refreshTemplates, setRefreshTemplates] = useState(0);

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees-for-badges", empresaFilter, setorFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("employees")
        .select(`
          id,
          nome_completo,
          cargo,
          setor,
          foto_url,
          cpf,
          status,
          empresa_id,
          empresas (
            id,
            nome,
            logo_url
          )
        `)
        .order("nome_completo");

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as "ativo" | "ferias" | "afastado" | "demitido");
      }

      if (empresaFilter !== "all") {
        query = query.eq("empresa_id", empresaFilter);
      }

      if (setorFilter !== "all") {
        query = query.eq("setor", setorFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-for-badges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: setores = [] } = useQuery({
    queryKey: ["setores-for-badges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setores")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.cargo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAll = () => {
    if (selectedEmployees.size === filteredEmployees.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(filteredEmployees.map((e) => e.id)));
    }
  };

  const handleToggleEmployee = (employeeId: string) => {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId);
    } else {
      newSelected.add(employeeId);
    }
    setSelectedEmployees(newSelected);
  };

  const handleGeneratePDF = async () => {
    if (selectedEmployees.size === 0) {
      toast.error("Selecione pelo menos um funcionário");
      return;
    }

    setIsGenerating(true);
    try {
      const selectedData = filteredEmployees
        .filter((e) => selectedEmployees.has(e.id))
        .map((e) => ({
          id: e.id,
          nome_completo: e.nome_completo,
          cargo: e.cargo,
          setor: e.setor,
          foto_url: e.foto_url,
          cpf: e.cpf,
          empresa: e.empresas
            ? {
                nome: e.empresas.nome,
                logo_url: e.empresas.logo_url,
              }
            : null,
        }));

      if (templateTab === "personalizado" && selectedCustomTemplate) {
        // Use custom template
        const { data: fullTemplate, error } = await supabase
          .from('cracha_templates')
          .select('*')
          .eq('id', selectedCustomTemplate.id)
          .single();

        if (error) throw error;

        await generateCustomBadgesPDF(selectedData, {
          ...fullTemplate,
          orientacao: fullTemplate.orientacao as 'horizontal' | 'vertical',
          configuracao_json: fullTemplate.configuracao_json as any,
        });
      } else {
        // Use predefined template
        await generateBadgesPDF(selectedData, {
          showCpf,
          showSector,
          showCompanyLogo,
          showPhoto,
          showCargo,
          orientation,
          template: selectedTemplate,
          customHeaderColor: customColor || undefined,
        });
      }

      toast.success(`PDF gerado com ${selectedData.length} crachá(s)`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF de crachás");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditTemplate = (templateId: string) => {
    setEditingTemplateId(templateId);
    setShowEditor(true);
  };

  const handleSelectCustomTemplate = (template: CustomTemplate) => {
    setSelectedCustomTemplate(template);
  };

  const handleSaveTemplate = () => {
    setShowEditor(false);
    setEditingTemplateId(undefined);
    setRefreshTemplates((r) => r + 1);
    toast.success("Template salvo com sucesso!");
  };

  const allSelected = filteredEmployees.length > 0 && selectedEmployees.size === filteredEmployees.length;

  // Template preview component
  const TemplatePreview = ({ template, isSelected }: { template: BadgeTemplate; isSelected: boolean }) => (
    <button
      onClick={() => setSelectedTemplate(template)}
      className={`group relative overflow-hidden rounded-xl border-2 transition-all duration-200 ${
        isSelected
          ? "border-primary ring-2 ring-primary/30 scale-[1.02]"
          : "border-transparent hover:border-primary/40 hover:scale-[1.01]"
      }`}
    >
      {/* Mini badge preview */}
      <div className="w-full aspect-[1.6] relative">
        {template.style === "modern" && (
          <div className="absolute inset-0 bg-gradient-to-b from-background to-muted/50 p-1.5">
            <div
              className="h-3 rounded-t-md"
              style={{ backgroundColor: template.headerColor }}
            />
            <div
              className="h-0.5"
              style={{ backgroundColor: template.accentColor }}
            />
            <div className="flex gap-1.5 mt-1.5 px-1">
              <div className="w-5 h-5 rounded bg-muted border" style={{ borderColor: template.headerColor }} />
              <div className="flex-1 space-y-1">
                <div className="h-1.5 bg-foreground/60 rounded w-3/4" />
                <div className="h-1 bg-muted-foreground/40 rounded w-1/2" />
              </div>
            </div>
          </div>
        )}
        {template.style === "classic" && (
          <div className="absolute inset-0 bg-background p-1.5 border-2 rounded-md" style={{ borderColor: template.headerColor }}>
            <div
              className="h-2.5 rounded-sm"
              style={{ backgroundColor: template.headerColor }}
            />
            <div className="h-px mt-1" style={{ backgroundColor: template.headerColor }} />
            <div className="flex gap-1.5 mt-1 px-0.5">
              <div className="w-5 h-5 bg-muted rounded-sm" />
              <div className="flex-1 space-y-1">
                <div className="h-1.5 bg-foreground/60 rounded w-3/4" />
                <div className="h-1 bg-muted-foreground/40 rounded w-1/2" />
              </div>
            </div>
          </div>
        )}
        {template.style === "minimal" && (
          <div className="absolute inset-0 bg-background p-1.5 rounded-md border border-border">
            <div
              className="h-1 rounded-full"
              style={{ backgroundColor: template.headerColor }}
            />
            <div className="flex gap-1.5 mt-2 px-0.5">
              <div className="w-6 h-6 bg-muted rounded-full" />
              <div className="flex-1 space-y-1 mt-1">
                <div className="h-1.5 bg-foreground/60 rounded w-2/3" />
                <div className="h-1 bg-muted-foreground/30 rounded w-1/2" />
              </div>
            </div>
          </div>
        )}
        {template.style === "corporate" && (
          <div className="absolute inset-0 bg-muted/30 p-1.5 rounded-md">
            <div
              className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-md"
              style={{ backgroundColor: template.headerColor }}
            />
            <div className="ml-2">
              <div
                className="h-2.5 rounded-sm -mx-0.5"
                style={{ backgroundColor: template.headerColor }}
              />
              <div className="flex gap-1.5 mt-1">
                <div className="w-5 h-5 bg-muted rounded-sm" style={{ borderLeft: `2px solid ${template.accentColor}` }} />
                <div className="flex-1 space-y-1">
                  <div className="h-1.5 rounded w-3/4" style={{ backgroundColor: template.headerColor }} />
                  <div className="h-1 bg-muted-foreground/40 rounded w-1/2" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="p-2 bg-card border-t">
        <span className="text-xs font-medium block truncate">{template.name}</span>
      </div>
      {isSelected && (
        <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-md">
          <span className="text-primary-foreground text-xs font-bold">✓</span>
        </div>
      )}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Buscar</Label>
              <Input
                placeholder="Nome ou cargo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Setor</Label>
              <Select value={setorFilter} onValueChange={setSetorFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {setores.map((setor) => (
                    <SelectItem key={setor.id} value={setor.nome}>
                      {setor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="ferias">Férias</SelectItem>
                  <SelectItem value="afastado">Afastados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Selection with Tabs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5" />
              Templates de Crachá
            </CardTitle>
            <Button onClick={() => { setEditingTemplateId(undefined); setShowEditor(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={templateTab} onValueChange={(v) => setTemplateTab(v as "predefinido" | "personalizado")}>
            <TabsList className="mb-4">
              <TabsTrigger value="predefinido">Templates Predefinidos</TabsTrigger>
              <TabsTrigger value="personalizado">Meus Templates</TabsTrigger>
            </TabsList>
            
            <TabsContent value="predefinido">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {BADGE_TEMPLATES.map((template) => (
                  <TemplatePreview
                    key={template.id}
                    template={template}
                    isSelected={selectedTemplate.id === template.id}
                  />
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="personalizado">
              <BadgeTemplateList
                key={refreshTemplates}
                onEdit={handleEditTemplate}
                onSelect={handleSelectCustomTemplate}
                selectedTemplateId={selectedCustomTemplate?.id}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Badge Options - only show for predefined templates */}
      {templateTab === "predefinido" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Opções do Crachá
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Orientation */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Orientação</Label>
              <div className="flex gap-3">
                <button
                  onClick={() => setOrientation("horizontal")}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    orientation === "horizontal"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <RectangleHorizontal className="h-5 w-5" />
                  <span className="font-medium">Horizontal</span>
                </button>
                <button
                  onClick={() => setOrientation("vertical")}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    orientation === "vertical"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <RectangleVertical className="h-5 w-5" />
                  <span className="font-medium">Vertical</span>
                </button>
              </div>
            </div>

            {/* Custom Color */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Cor Personalizada</Label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Input
                    type="color"
                    value={customColor || selectedTemplate.headerColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                </div>
                <span className="text-sm text-muted-foreground">
                  {customColor || selectedTemplate.headerColor}
                </span>
                {customColor && (
                  <Button variant="ghost" size="sm" onClick={() => setCustomColor("")}>
                    Resetar
                  </Button>
                )}
              </div>
            </div>

            {/* Toggle Options */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Elementos Visíveis</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <Switch checked={showPhoto} onCheckedChange={setShowPhoto} id="showPhoto" />
                  <Label htmlFor="showPhoto" className="cursor-pointer">Foto</Label>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <Switch checked={showCargo} onCheckedChange={setShowCargo} id="showCargo" />
                  <Label htmlFor="showCargo" className="cursor-pointer">Cargo</Label>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <Switch checked={showSector} onCheckedChange={setShowSector} id="showSector" />
                  <Label htmlFor="showSector" className="cursor-pointer">Setor</Label>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <Switch checked={showCpf} onCheckedChange={setShowCpf} id="showCpf" />
                  <Label htmlFor="showCpf" className="cursor-pointer">CPF</Label>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <Switch checked={showCompanyLogo} onCheckedChange={setShowCompanyLogo} id="showLogo" />
                  <Label htmlFor="showLogo" className="cursor-pointer">Logo</Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Funcionários ({filteredEmployees.length})
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <Badge variant="secondary">{selectedEmployees.size} selecionado(s)</Badge>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {allSelected ? "Desmarcar Todos" : "Selecionar Todos"}
              </Button>
              <Button 
                onClick={handleGeneratePDF} 
                disabled={
                  selectedEmployees.size === 0 || 
                  isGenerating ||
                  (templateTab === "personalizado" && !selectedCustomTemplate)
                }
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4 mr-2" />
                )}
                Gerar PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingEmployees ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum funcionário encontrado</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredEmployees.map((employee) => (
                <div
                  key={employee.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedEmployees.has(employee.id) ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                  }`}
                  onClick={() => handleToggleEmployee(employee.id)}
                >
                  <Checkbox
                    checked={selectedEmployees.has(employee.id)}
                    onCheckedChange={() => handleToggleEmployee(employee.id)}
                  />
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={employee.foto_url || undefined} />
                    <AvatarFallback>{employee.nome_completo.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{employee.nome_completo}</p>
                    <p className="text-sm text-muted-foreground truncate">{employee.cargo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visual Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplateId ? "Editar Template" : "Criar Novo Template"}
            </DialogTitle>
          </DialogHeader>
          <BadgeVisualEditor
            templateId={editingTemplateId}
            onSave={handleSaveTemplate}
            onCancel={() => setShowEditor(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CrachaEmployeeList;

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Eye } from "lucide-react";

/** Botão "Ver como colaborador": escolhe a pessoa e abre o painel dela (só visualização) */
export const VerComoColaboradorButton = ({ variant = "outline" }: { variant?: "outline" | "default" | "secondary" }) => {
  const [aberto, setAberto] = useState(false);
  const navigate = useNavigate();
  const { data: lista = [] } = useQuery({
    queryKey: ["ver-como-lista"],
    enabled: aberto,
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, nome_completo, cargo, setor").neq("status", "demitido").order("nome_completo");
      return data || [];
    },
  });
  return (
    <>
      <Button variant={variant} onClick={() => setAberto(true)}><Eye className="mr-2 h-4 w-4" />Ver como colaborador</Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="p-0 sm:max-w-lg">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>Ver o painel como colaborador</DialogTitle>
            <DialogDescription>Abre o portal exatamente como a pessoa vê. É só visualização: nada é assinado ou marcado em nome dela.</DialogDescription>
          </DialogHeader>
          <Command className="border-t">
            <CommandInput placeholder="Digite o nome…" autoFocus />
            <CommandList className="max-h-[50vh]">
              <CommandEmpty>Ninguém encontrado.</CommandEmpty>
              <CommandGroup>
                {lista.map((e: any) => (
                  <CommandItem key={e.id} value={`${e.nome_completo} ${e.cargo || ""} ${e.setor || ""} ${e.id}`} onSelect={() => { setAberto(false); navigate(`/ver-como/${e.id}`); }}>
                    <span className="min-w-0">
                      <span className="block truncate">{e.nome_completo}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[e.cargo, e.setor].filter(Boolean).join(" · ")}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VerComoColaboradorButton;

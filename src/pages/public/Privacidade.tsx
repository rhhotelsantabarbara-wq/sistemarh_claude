import { Card } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="p-6 space-y-4 text-sm leading-relaxed">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Política de Privacidade</h1>
          </div>
          <p className="text-muted-foreground">Sistema de RH do Hotel Fazenda Santa Bárbara</p>

          <p>
            Este sistema é de uso interno do Hotel Fazenda Santa Bárbara para a gestão de recursos humanos
            (cadastro de colaboradores, ponto, folha de pagamento, holerites, treinamentos e documentos).
            O acesso é restrito a colaboradores e gestores autorizados.
          </p>

          <h2 className="text-base font-semibold">Dados tratados</h2>
          <p>
            Tratamos apenas os dados necessários às obrigações trabalhistas e à gestão de pessoas, em
            conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Os dados não são
            vendidos nem compartilhados com terceiros, exceto quando exigido por lei.
          </p>

          <h2 className="text-base font-semibold">Integração com o Google</h2>
          <p>
            Com autorização de um gestor, o sistema se conecta à conta Google da empresa para salvar cópias
            de documentos gerados (holerites, recibos e termos) em uma pasta de backup no Google Drive e,
            opcionalmente, sincronizar eventos com o Google Agenda. O sistema acessa somente os arquivos e
            eventos necessários a essas funções e não usa esses dados para nenhuma outra finalidade.
            A autorização pode ser revogada a qualquer momento em Configurações → Google Drive ou em
            myaccount.google.com/permissions.
          </p>

          <h2 className="text-base font-semibold">Contato</h2>
          <p>
            Dúvidas sobre privacidade: <a className="text-primary underline" href="mailto:rhhotelsantabarbara@gmail.com">rhhotelsantabarbara@gmail.com</a>
          </p>
        </Card>
      </div>
    </div>
  );
}

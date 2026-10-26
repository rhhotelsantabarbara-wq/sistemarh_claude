import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Calendar } from "lucide-react";
import TimeOffForm from "@/components/forms/TimeOffForm";
import { dataBR } from "@/lib/date";

interface TimeOffTabProps {
  employeeId: string;
}

const TimeOffTab = ({ employeeId }: TimeOffTabProps) => {
  const [folgas, setFolgas] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchFolgas();
  }, [employeeId]);

  const fetchFolgas = async () => {
    const { data } = await supabase
      .from("folgas")
      .select("*")
      .eq("employee_id", employeeId)
      .order("data", { ascending: false });

    setFolgas(data || []);
  };

  const handleSaved = () => {
    setShowForm(false);
    fetchFolgas();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Folgas na Casa</h3>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Registrar Folga
        </Button>
      </div>

      {showForm && (
        <TimeOffForm
          employeeId={employeeId}
          onSaved={handleSaved}
          onCancel={() => setShowForm(false)}
        />
      )}

      {folgas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma folga registrada
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {folgas.map((folga) => (
            <Card key={folga.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {dataBR(folga.data).toLocaleDateString("pt-BR")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Motivo</p>
                <p className="font-medium">{folga.motivo}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TimeOffTab;

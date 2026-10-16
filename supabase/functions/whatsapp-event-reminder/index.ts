import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { exigirSegredoCron } from "../_shared/segredoExterno.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const bloqueio = exigirSegredoCron(req);
  if (bloqueio) return bloqueio;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get WhatsApp config
    const { data: config } = await supabase
      .from("configuracoes_whatsapp")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!config || !config.evolution_api_url || !config.evolution_api_key || !config.evolution_instance_name) {
      return new Response(JSON.stringify({ status: "skipped", reason: "WhatsApp not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();

    // Fetch events in a wide window:
    // - Up to 24h in the future (upcoming events)
    // - Up to 2h in the past (catch missed cron runs where event just passed)
    const windowStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: eventos, error } = await supabase
      .from("eventos")
      .select("*")
      .eq("lembrete_enviado", false)
      .eq("concluido", false)
      .not("whatsapp_phone", "is", null)
      .gte("data_inicio", windowStart.toISOString())
      .lte("data_inicio", windowEnd.toISOString());

    if (error) {
      console.error("Error fetching events:", error);
      throw error;
    }

    if (!eventos || eventos.length === 0) {
      return new Response(JSON.stringify({ status: "ok", reminders_sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { evento_id: string; phone: string; status: string }[] = [];

    for (const evento of eventos) {
      const eventTime = new Date(evento.data_inicio).getTime();
      const lembreteMinutos = evento.lembrete_minutos || 30;
      const reminderTime = eventTime - lembreteMinutos * 60 * 1000;
      const nowMs = now.getTime();

      // Send if reminder time has already passed (no strict 5-min window — catches missed cron runs)
      if (nowMs >= reminderTime) {
        try {
          const eventDate = new Date(evento.data_inicio);
          const hora = eventDate.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Sao_Paulo",
          });

          const texto = `⏰ *Lembrete!*\n\nSeu compromisso *${evento.titulo}* começa em *${lembreteMinutos} minutos* (às ${hora}).${evento.local ? `\n📍 Local: ${evento.local}` : ""}${evento.descricao ? `\n📝 ${evento.descricao}` : ""}`;

          const sendUrl = `${config.evolution_api_url.replace(/\/$/, "")}/message/sendText/${config.evolution_instance_name}`;
          const sendResponse = await fetch(sendUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: config.evolution_api_key,
            },
            body: JSON.stringify({
              number: evento.whatsapp_phone,
              text: texto,
            }),
          });

          if (!sendResponse.ok) {
            const sendError = await sendResponse.text();
            throw new Error(`Send failed: ${sendResponse.status} - ${sendError}`);
          }

          // Mark reminder as sent
          await supabase
            .from("eventos")
            .update({ lembrete_enviado: true })
            .eq("id", evento.id);

          console.log(`Reminder sent for event "${evento.titulo}" to ${evento.whatsapp_phone}`);
          results.push({ evento_id: evento.id, phone: evento.whatsapp_phone, status: "sent" });
        } catch (sendErr) {
          console.error(`Error sending reminder for event ${evento.id}:`, sendErr);
          results.push({
            evento_id: evento.id,
            phone: evento.whatsapp_phone,
            status: "error",
          });
        }
      }
    }

    return new Response(JSON.stringify({ status: "ok", reminders_sent: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Event reminder error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

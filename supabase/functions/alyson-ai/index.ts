// Alyson AI assistant — page-aware streaming responses via Lovable AI Gateway.
// deno-lint-ignore-file no-explicit-any

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are Alyson, the operations copilot inside Alyson HR.
You explain payroll, bonus, equity, leave, and KPI figures in plain English.
Be concise (2-4 short paragraphs max). Show formulas as inline code.
When the user gives you a "page context" tag, ground your answer in it.
Never invent dollar amounts — refer the user to the related drill-down.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { messages, page } = await req.json();
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    const sys = page
      ? `${SYSTEM}\n\nCurrent page context: ${page}`
      : SYSTEM;

    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          stream: true,
          messages: [{ role: "system", content: sys }, ...messages],
        }),
      },
    );

    if (!res.ok) {
      if (res.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Try again shortly." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (res.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI credits exhausted — top up in Workspace settings.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const t = await res.text();
      console.error("ai gateway", res.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(res.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("alyson-ai", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

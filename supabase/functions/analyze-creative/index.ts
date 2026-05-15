import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Tu es un expert en conversion rate optimization et publicité SaaS. Analyse cette creative publicitaire selon ces 6 critères et retourne UNIQUEMENT un objet JSON valide, sans texte avant ou après :

Clarté du message (0-20 pts)
Accroche visuelle (0-15 pts)
Proposition de valeur (0-25 pts)
Call to action (0-20 pts)
Preuve sociale (0-10 pts)
Adéquation cible (0-10 pts)

Format JSON attendu : { score: number, strengths: string[], weaknesses: string[], criteria: { name: string, score: number, max: number, tip: string }[] }`;

type AnalysisResult = {
  score: number;
  strengths: string[];
  weaknesses: string[];
  criteria: { name: string; score: number; max: number; tip: string }[];
};

function parseImagePayload(image: string): { mediaType: string; data: string } {
  const dataUrlMatch = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrlMatch) {
    return { mediaType: dataUrlMatch[1], data: dataUrlMatch[2] };
  }
  return { mediaType: "image/jpeg", data: image.replace(/\s/g, "") };
}

function extractJson(text: string): AnalysisResult {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const parsed = JSON.parse(candidate) as AnalysisResult;

  if (
    typeof parsed.score !== "number" ||
    !Array.isArray(parsed.strengths) ||
    !Array.isArray(parsed.weaknesses) ||
    !Array.isArray(parsed.criteria)
  ) {
    throw new Error("Invalid analysis shape");
  }

  return parsed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const image = body?.image;

    if (!image || typeof image !== "string") {
      return new Response(JSON.stringify({ error: "Missing image (base64)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mediaType, data } = parseImagePayload(image);

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data },
              },
              {
                type: "text",
                text: "Analyse cette creative publicitaire et retourne le JSON demandé.",
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Anthropic API request failed", details: errText }),
        {
          status: anthropicRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const anthropicJson = await anthropicRes.json();
    const textBlock = anthropicJson?.content?.find((b: { type: string }) => b.type === "text");
    const rawText = textBlock?.text;

    if (!rawText) {
      return new Response(JSON.stringify({ error: "Empty response from Claude" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = extractJson(rawText);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-creative error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

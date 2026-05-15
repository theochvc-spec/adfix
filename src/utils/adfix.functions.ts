import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LangEnum = z.enum(["fr", "en", "es"]).optional().default("fr");
const LANG_NAME: Record<"fr" | "en" | "es", string> = {
  fr: "français",
  en: "anglais (English)",
  es: "espagnol (Español)",
};

const InputSchema = z.object({
  imageDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|jpg|webp|gif);base64,/, "Format d'image invalide")
    .max(15_000_000, "Image trop lourde (max ~10MB)"),
  platform: z.string().trim().max(40).optional().default("Generic"),
  goal: z.string().trim().max(200).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
  lang: LangEnum,
});

const TOOL = {
  type: "function" as const,
  function: {
    name: "analyze_creative",
    description:
      "Analyse approfondie d'une créative publicitaire (visuel + copy à l'image), liste les erreurs et propose une version améliorée.",
    parameters: {
      type: "object",
      properties: {
        score: { type: "number", description: "Note de 0 à 100" },
        subscores: {
          type: "object",
          description: "Sous-scores 0-100 par dimension.",
          properties: {
            visual: { type: "number" },
            copy: { type: "number" },
            cta: { type: "number" },
            branding: { type: "number" },
            value_prop: { type: "number" },
            conversion_potential: { type: "number" },
          },
          required: ["visual", "copy", "cta", "branding", "value_prop", "conversion_potential"],
          additionalProperties: false,
        },
        summary: { type: "string", description: "Diagnostic court en 1-2 phrases" },
        target_audience: { type: "string", description: "Audience probable visée par cette créative." },
        predicted_ctr_impact: {
          type: "string",
          description: "Estimation qualitative de l'impact sur le CTR si on applique les fixes (ex: +20-35% CTR).",
        },
        hook_alternatives: {
          type: "array",
          items: { type: "string" },
          description: "3 à 5 accroches alternatives prêtes à tester.",
        },
        ab_test_ideas: {
          type: "array",
          items: { type: "string" },
          description: "3 idées d'A/B tests prioritaires.",
        },
        detected_text: {
          type: "string",
          description: "Texte présent sur la créative (transcription). Vide si aucun.",
        },
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              severity: { type: "string", enum: ["low", "medium", "high"] },
              category: {
                type: "string",
                enum: [
                  "visual_hierarchy",
                  "readability",
                  "contrast",
                  "cta",
                  "branding",
                  "copy",
                  "composition",
                  "color",
                  "typography",
                  "compliance",
                  "value_prop",
                ],
              },
              explanation: { type: "string" },
              fix: { type: "string" },
              impact: {
                type: "string",
                description: "Impact business attendu si l'erreur est corrigée (ex: +15% CTR, -20% CPC).",
              },
            },
            required: ["title", "severity", "category", "explanation", "fix", "impact"],
            additionalProperties: false,
          },
        },
        improved_brief: {
          type: "string",
          description:
            "Brief détaillé pour produire une nouvelle version de la créative (description visuelle + texte recommandé + CTA).",
        },
      },
      required: [
        "score",
        "subscores",
        "summary",
        "target_audience",
        "predicted_ctr_impact",
        "hook_alternatives",
        "ab_test_ideas",
        "detected_text",
        "issues",
        "improved_brief",
      ],
      additionalProperties: false,
    },
  },
};

export const analyzeAd = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI key not configured" };
    }

    const langName = LANG_NAME[data.lang];
    const system = `Tu es AdFix, expert mondial en créatives publicitaires performantes (Meta, Google, TikTok, LinkedIn, YouTube). Tu as audité +10 000 ads et tu connais les benchmarks par vertical.
Tu réalises une analyse FORENSIQUE et EXHAUSTIVE de la créative fournie : hiérarchie visuelle, lisibilité, contraste WCAG, CTA (clarté, placement, friction), branding (logo, couleurs marque), copy à l'image (hook, promesse, preuve, urgence), composition (règle des tiers, focal point, espace négatif), couleurs (psychologie, contraste, harmonie), typographie (poids, taille, lisibilité mobile), conformité (Meta/Google policies), value proposition, congruence audience, mobile-first.
Sois CHIRURGICAL : chaque issue doit pointer un élément précis (zone de l'image, mot, couleur). Estime l'impact business de chaque fix.
Identifie 6 à 10 issues réelles (pas de remplissage). Donne des sous-scores honnêtes. Propose des hooks alternatifs et des A/B tests prioritaires.
IMPORTANT : tous les champs textuels (summary, target_audience, predicted_ctr_impact, hook_alternatives, ab_test_ideas, issues.*, improved_brief) DOIVENT être rédigés en ${langName}. Le champ detected_text reste dans la langue d'origine de l'image.`;

    const userText = `Plateforme: ${data.platform}
Objectif: ${data.goal || "non précisé"}
Notes: ${data.notes || "aucune"}
Langue de réponse: ${langName}

Audit cette créative en profondeur. Identifie 6 à 10 erreurs précises et hiérarchisées (priorise visuel + copy + CTA + value prop). Pour chaque erreur, donne un fix opérationnel et estime son impact business. Termine par un brief ultra-détaillé pour produire une version next-level (composition, palette, typographie, copy exact, CTA exact).`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content: [
                { type: "text", text: userText },
                { type: "image_url", image_url: { url: data.imageDataUrl } },
              ],
            },
          ],
          tools: [TOOL],
          tool_choice: { type: "function", function: { name: "analyze_creative" } },
        }),
      });

      if (!res.ok) {
        if (res.status === 429) return { ok: false as const, error: "Limite atteinte, réessayez dans un instant." };
        if (res.status === 402) return { ok: false as const, error: "Crédits IA épuisés. Ajoutez des crédits dans votre workspace Lovable." };
        const t = await res.text();
        console.error("AI gateway error", res.status, t);
        return { ok: false as const, error: "Erreur du service IA." };
      }

      const json = await res.json();
      const call = json?.choices?.[0]?.message?.tool_calls?.[0];
      const argsStr = call?.function?.arguments;
      if (!argsStr) return { ok: false as const, error: "Réponse IA invalide." };
      const parsed = JSON.parse(argsStr);
      return { ok: true as const, result: parsed };
    } catch (e) {
      console.error(e);
      return { ok: false as const, error: "Erreur réseau." };
    }
  });

const GenSchema = z.object({
  brief: z.string().trim().min(10).max(2000),
  platform: z.string().trim().max(40).optional().default("Generic"),
  lang: LangEnum,
  model: z
    .enum([
      "google/gemini-2.5-flash-image",
      "google/gemini-3.1-flash-image-preview",
      "google/gemini-3-pro-image-preview",
    ])
    .optional()
    .default("google/gemini-3-pro-image-preview"),
});

export const generateCreative = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GenSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false as const, error: "AI key not configured" };

    const langName = LANG_NAME[data.lang];
    const prompt = `Créative publicitaire optimisée pour ${data.platform}. Suis ce brief avec précision :

${data.brief}

Tout texte visible sur l'image doit être en ${langName}.
Style : moderne, épuré, contraste élevé, hiérarchie visuelle claire, CTA visible, typographie lisible.
FORMAT OBLIGATOIRE : carré 1:1 pour feed Instagram (ratio 1080x1080). Composition centrée, marges de sécurité respectées pour le feed Instagram.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: data.model,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });

      if (!res.ok) {
        if (res.status === 429) return { ok: false as const, error: "Limite atteinte, réessayez dans un instant." };
        if (res.status === 402) return { ok: false as const, error: "Crédits IA épuisés." };
        const t = await res.text();
        console.error("Image gen error", res.status, t);
        return { ok: false as const, error: "Erreur de génération d'image." };
      }
      const json = await res.json();
      const url: string | undefined = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!url) return { ok: false as const, error: "Aucune image générée." };
      return { ok: true as const, imageDataUrl: url };
    } catch (e) {
      console.error(e);
      return { ok: false as const, error: "Erreur réseau." };
    }
  });

const AccountInputSchema = z.object({
  imageDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|jpg|webp|gif);base64,/, "Format d'image invalide")
    .max(15_000_000, "Image trop lourde (max ~10MB)"),
  platform: z.string().trim().max(40).optional().default("Instagram"),
  notes: z.string().trim().max(500).optional().default(""),
  lang: LangEnum,
});

const ACCOUNT_TOOL = {
  type: "function" as const,
  function: {
    name: "analyze_account",
    description:
      "Analyse un screenshot du profil / compte de l'annonceur (bio, photo, feed, highlights, nom) pour évaluer sa crédibilité et son alignement avec son ad.",
    parameters: {
      type: "object",
      properties: {
        score: { type: "number", description: "Note de crédibilité du compte 0-100" },
        summary: { type: "string", description: "Diagnostic global du compte en 1-2 phrases" },
        detected_handle: { type: "string", description: "@handle ou nom d'utilisateur détecté. Vide si aucun." },
        strengths: { type: "array", items: { type: "string" }, description: "Points forts du compte." },
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              severity: { type: "string", enum: ["low", "medium", "high"] },
              category: {
                type: "string",
                enum: [
                  "bio",
                  "profile_picture",
                  "feed_consistency",
                  "highlights",
                  "social_proof",
                  "naming",
                  "branding",
                  "trust",
                  "ad_alignment",
                  "compliance",
                ],
              },
              explanation: { type: "string" },
              fix: { type: "string" },
            },
            required: ["title", "severity", "category", "explanation", "fix"],
            additionalProperties: false,
          },
        },
        recommendations: {
          type: "string",
          description: "Plan d'action concret pour aligner le compte avec une stratégie ads performante.",
        },
      },
      required: ["score", "summary", "detected_handle", "strengths", "issues", "recommendations"],
      additionalProperties: false,
    },
  },
};

export const analyzeAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AccountInputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false as const, error: "AI key not configured" };

    const langName = LANG_NAME[data.lang];
    const system = `Tu es AdFix, expert en social media + ads paid. On te montre un screenshot du profil/compte (Instagram, TikTok, Facebook, LinkedIn) de l'annonceur qui lance une publicité.
Tu évalues la crédibilité, la cohérence et l'alignement du compte avec son objectif publicitaire : photo de profil, bio, nom, feed, highlights, social proof (followers, posts), tonalité, branding.
Identifie 3 à 6 erreurs/points faibles concrets et propose des fixes actionnables.
IMPORTANT : tous les champs textuels DOIVENT être rédigés en ${langName}. Le champ detected_handle reste tel quel.`;

    const userText = `Plateforme du compte : ${data.platform}
Notes : ${data.notes || "aucune"}
Langue de réponse : ${langName}

Analyse ce screenshot du compte de l'annonceur. Évalue sa crédibilité et son potentiel à convertir le trafic ads en clients.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content: [
                { type: "text", text: userText },
                { type: "image_url", image_url: { url: data.imageDataUrl } },
              ],
            },
          ],
          tools: [ACCOUNT_TOOL],
          tool_choice: { type: "function", function: { name: "analyze_account" } },
        }),
      });
      if (!res.ok) {
        if (res.status === 429) return { ok: false as const, error: "Limite atteinte, réessayez dans un instant." };
        if (res.status === 402) return { ok: false as const, error: "Crédits IA épuisés." };
        const t = await res.text();
        console.error("AI gateway error", res.status, t);
        return { ok: false as const, error: "Erreur du service IA." };
      }
      const json = await res.json();
      const call = json?.choices?.[0]?.message?.tool_calls?.[0];
      const argsStr = call?.function?.arguments;
      if (!argsStr) return { ok: false as const, error: "Réponse IA invalide." };
      const parsed = JSON.parse(argsStr);
      return { ok: true as const, result: parsed };
    } catch (e) {
      console.error(e);
      return { ok: false as const, error: "Erreur réseau." };
    }
  });

const SpyInputSchema = z.object({
  market: z.string().trim().min(2).max(300),
  country: z.string().trim().min(2).max(4).optional().default("FR"),
  lang: LangEnum,
});

const SPY_TOOL = {
  type: "function" as const,
  function: {
    name: "spy_competitor_ads",
    description:
      "Analyse un ensemble d'ads concurrentes scrapées depuis Meta Ad Library et identifie les patterns gagnants.",
    parameters: {
      type: "object",
      properties: {
        market_summary: { type: "string", description: "Résumé du marché et des angles dominants observés." },
        winning_patterns: {
          type: "array",
          items: {
            type: "object",
            properties: {
              pattern: { type: "string", description: "Le pattern observé (hook, format, angle, CTA, offre…)." },
              why_it_works: { type: "string" },
              examples: { type: "array", items: { type: "string" }, description: "Phrases ou éléments visuels concrets repérés." },
            },
            required: ["pattern", "why_it_works", "examples"],
            additionalProperties: false,
          },
        },
        ads: {
          type: "array",
          items: {
            type: "object",
            properties: {
              advertiser: { type: "string" },
              hook: { type: "string", description: "L'accroche principale de l'ad." },
              angle: { type: "string", description: "L'angle marketing utilisé." },
              cta: { type: "string" },
              format: { type: "string", description: "Image, vidéo, carrousel…" },
              why_it_works: { type: "string" },
              image_url: {
                type: "string",
                description: "URL EXACTE du visuel de l'ad copiée depuis la liste fournie (scontent / fbcdn). Vide si aucune ne correspond.",
              },
            },
            required: ["advertiser", "hook", "angle", "cta", "format", "why_it_works", "image_url"],
            additionalProperties: false,
          },
        },
        copy_paste_brief: {
          type: "string",
          description: "Brief prêt à coller dans le générateur d'image AdFix, inspiré des meilleures ads observées.",
        },
      },
      required: ["market_summary", "winning_patterns", "ads", "copy_paste_brief"],
      additionalProperties: false,
    },
  },
};

export const spyCompetitorAds = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SpyInputSchema.parse(input))
  .handler(async ({ data }) => {
    const aiKey = process.env.LOVABLE_API_KEY;
    const fcKey = process.env.FIRECRAWL_API_KEY;
    if (!aiKey) return { ok: false as const, error: "AI key not configured" };
    if (!fcKey) return { ok: false as const, error: "Firecrawl key not configured" };

    const country = (data.country || "FR").toUpperCase();
    const query = encodeURIComponent(data.market);
    const adLibUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&q=${query}&search_type=keyword_unordered`;

    let scrapedMarkdown = "";
    let scrapedLinks: string[] = [];
    let scrapedHtml = "";
    try {
      const fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${fcKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url: adLibUrl,
          formats: ["markdown", "links", "html"],
          onlyMainContent: false,
          waitFor: 4000,
        }),
      });
      if (!fcRes.ok) {
        const txt = await fcRes.text();
        console.error("Firecrawl error", fcRes.status, txt);
        return { ok: false as const, error: "Impossible d'accéder à Meta Ad Library." };
      }
      const fcJson = await fcRes.json();
      scrapedMarkdown =
        fcJson?.data?.markdown || fcJson?.markdown || "";
      scrapedLinks = fcJson?.data?.links || fcJson?.links || [];
      scrapedHtml = fcJson?.data?.html || fcJson?.html || "";
    } catch (e) {
      console.error(e);
      return { ok: false as const, error: "Erreur réseau Firecrawl." };
    }

    if (!scrapedMarkdown || scrapedMarkdown.length < 200) {
      return { ok: false as const, error: "Aucune ad exploitable récupérée pour ce marché." };
    }

    // Extract ad creative image URLs from HTML (Meta CDN)
    const imageUrls: string[] = [];
    const seen = new Set<string>();
    const imgRegex = /https?:\/\/[^\s"'<>)]+?\.(?:fbcdn|cdninstagram)\.[^\s"'<>)]+?\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>)]*)?/gi;
    const mdImgRegex = /https?:\/\/[^\s"'<>)]+?\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>)]*)?/gi;
    for (const src of [scrapedHtml, scrapedMarkdown]) {
      if (!src) continue;
      const matches = src.match(src === scrapedHtml ? imgRegex : mdImgRegex) || [];
      for (const m of matches) {
        const clean = m.replace(/&amp;/g, "&");
        if (clean.includes("static") || clean.includes("emoji") || clean.includes("rsrc.php")) continue;
        if (!seen.has(clean)) {
          seen.add(clean);
          imageUrls.push(clean);
          if (imageUrls.length >= 30) break;
        }
      }
      if (imageUrls.length >= 30) break;
    }

    const truncated = scrapedMarkdown.slice(0, 18000);
    const langName = LANG_NAME[data.lang];
    const system = `Tu es un expert en ads paid social et en veille concurrentielle. Tu reçois le contenu brut de Meta Ad Library pour un marché donné. Tu dois identifier les ads les plus pertinentes (les annonceurs qui poussent fort, les hooks récurrents, les angles qui fonctionnent), résumer les patterns gagnants et produire un brief actionnable.
Réponds entièrement en ${langName}.`;
    const userText = `Marché / niche : ${data.market}
Pays : ${country}

Voici le contenu brut récupéré depuis Meta Ad Library (peut être bruité) :

${truncated}

Voici les URLs des visuels (creatives) repérés sur la page, dans l'ordre d'apparition :
${imageUrls.map((u, i) => `[${i + 1}] ${u}`).join("\n") || "(aucune image extraite)"}

Identifie 4 à 8 ads concrètes (advertiser + hook + angle + CTA + format), liste 3 à 5 patterns gagnants, puis rédige un brief prêt à coller dans un générateur d'image pour produire une ad qui s'inspire des meilleurs sans copier directement.
Pour chaque ad, associe le champ image_url à l'URL EXACTE (recopiée telle quelle) du visuel correspondant dans la liste ci-dessus. Si aucune image ne correspond avec certitude, laisse image_url vide.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: userText },
          ],
          tools: [SPY_TOOL],
          tool_choice: { type: "function", function: { name: "spy_competitor_ads" } },
        }),
      });
      if (!res.ok) {
        if (res.status === 429) return { ok: false as const, error: "Limite atteinte, réessayez dans un instant." };
        if (res.status === 402) return { ok: false as const, error: "Crédits IA épuisés." };
        const t = await res.text();
        console.error("AI gateway error", res.status, t);
        return { ok: false as const, error: "Erreur du service IA." };
      }
      const json = await res.json();
      const call = json?.choices?.[0]?.message?.tool_calls?.[0];
      const argsStr = call?.function?.arguments;
      if (!argsStr) return { ok: false as const, error: "Réponse IA invalide." };
      const parsed = JSON.parse(argsStr);
      const adLibLinks = scrapedLinks
        .filter((l) => typeof l === "string" && l.includes("facebook.com/ads/library"))
        .slice(0, 12);
      return {
        ok: true as const,
        result: parsed,
        adLibraryUrl: adLibUrl,
        sampleLinks: adLibLinks,
        imageUrls,
      };
    } catch (e) {
      console.error(e);
      return { ok: false as const, error: "Erreur réseau." };
    }
  });
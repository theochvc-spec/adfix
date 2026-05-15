export type Lang = "fr" | "en" | "es";

export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "fr", label: "Français", short: "FR" },
  { code: "en", label: "English", short: "EN" },
  { code: "es", label: "Español", short: "ES" },
];

export const LANG_NAMES: Record<Lang, string> = {
  fr: "français",
  en: "anglais",
  es: "espagnol",
};

type Dict = {
  nav_cta: string;
  hero_badge: string;
  hero_title_1: string;
  hero_title_2: string;
  hero_subtitle: string;
  drop_title: string;
  drop_hint: string;
  platform: string;
  goal: string;
  goal_placeholder: string;
  notes: string;
  notes_placeholder: string;
  analyze: string;
  analyzing: string;
  no_image_error: string;
  errors_title: string;
  score: string;
  new_creative: string;
  brief: string;
  copy_brief: string;
  copied: string;
  generate_image: string;
  regenerate: string;
  generating: string;
  detected_text: string;
  fix_label: string;
  step1_t: string;
  step1_d: string;
  step2_t: string;
  step2_d: string;
  step3_t: string;
  step3_d: string;
  language: string;
  spy_title: string;
  spy_subtitle: string;
  spy_market_label: string;
  spy_market_placeholder: string;
  spy_country_label: string;
  spy_run: string;
  spy_running: string;
  spy_market_required: string;
  spy_market_summary: string;
  spy_patterns: string;
  spy_ads_found: string;
  spy_brief: string;
  spy_open_library: string;
  spy_use_brief: string;
};

export const t: Record<Lang, Dict> = {
  fr: {
    nav_cta: "Analyser ma créative",
    hero_badge: "Audit IA de vos créatives publicitaires",
    hero_title_1: "Vos créatives ne convertissent pas ?",
    hero_title_2: "AdFix les corrige.",
    hero_subtitle:
      "Glissez votre visuel publicitaire. AdFix analyse hiérarchie, lisibilité, CTA, branding, et génère une nouvelle créative optimisée.",
    drop_title: "Glissez votre créative ici",
    drop_hint: "cliquez pour parcourir, ou collez avec ⌘/Ctrl+V — PNG, JPG, WebP — max 8MB",
    platform: "Plateforme",
    goal: "Objectif (optionnel)",
    goal_placeholder: "Ex : générer des leads B2B",
    notes: "Contexte / Notes (optionnel)",
    notes_placeholder: "Cible, offre, contraintes de marque…",
    analyze: "Analyser la créative",
    analyzing: "Analyse en cours…",
    no_image_error: "Glissez d'abord une créative.",
    errors_title: "Erreurs détectées",
    score: "Score",
    new_creative: "Nouvelle créative",
    brief: "Brief",
    copy_brief: "Copier brief",
    copied: "Copié",
    generate_image: "Générer image",
    regenerate: "Régénérer",
    generating: "Génération…",
    detected_text: "Texte détecté",
    fix_label: "Correction",
    step1_t: "1. Glissez",
    step1_d: "Votre créative publicitaire (image, bannière, post).",
    step2_t: "2. Analysez",
    step2_d: "AdFix audite visuel, copy, CTA, hiérarchie et branding.",
    step3_t: "3. Régénérez",
    step3_d: "Obtenez un brief + une nouvelle créative générée par IA.",
    language: "Langue",
    spy_title: "Espionnez vos concurrents sur Meta Ads",
    spy_subtitle:
      "Décrivez votre marché : AdFix scanne Meta Ad Library, identifie les ads actives des concurrents et extrait les patterns qui fonctionnent.",
    spy_market_label: "Votre marché / niche",
    spy_market_placeholder: "Ex : coaching fitness en ligne pour femmes 30-45 ans",
    spy_country_label: "Pays",
    spy_run: "Espionner les concurrents",
    spy_running: "Scan de Meta Ad Library…",
    spy_market_required: "Décrivez d'abord votre marché.",
    spy_market_summary: "Vue d'ensemble du marché",
    spy_patterns: "Patterns gagnants",
    spy_ads_found: "Ads concurrentes détectées",
    spy_brief: "Brief inspiré (copy-paste)",
    spy_open_library: "Ouvrir Meta Ad Library",
    spy_use_brief: "Utiliser ce brief",
  },
  en: {
    nav_cta: "Analyze my creative",
    hero_badge: "AI audit for your ad creatives",
    hero_title_1: "Your creatives aren't converting?",
    hero_title_2: "AdFix fixes them.",
    hero_subtitle:
      "Drop your ad visual. AdFix reviews hierarchy, readability, CTA, branding — then generates an optimized new creative.",
    drop_title: "Drop your creative here",
    drop_hint: "click to browse, or paste with ⌘/Ctrl+V — PNG, JPG, WebP — max 8MB",
    platform: "Platform",
    goal: "Goal (optional)",
    goal_placeholder: "e.g. generate B2B leads",
    notes: "Context / Notes (optional)",
    notes_placeholder: "Audience, offer, brand constraints…",
    analyze: "Analyze creative",
    analyzing: "Analyzing…",
    no_image_error: "Drop a creative first.",
    errors_title: "Issues detected",
    score: "Score",
    new_creative: "New creative",
    brief: "Brief",
    copy_brief: "Copy brief",
    copied: "Copied",
    generate_image: "Generate image",
    regenerate: "Regenerate",
    generating: "Generating…",
    detected_text: "Detected text",
    fix_label: "Fix",
    step1_t: "1. Drop",
    step1_d: "Your ad creative (image, banner, post).",
    step2_t: "2. Analyze",
    step2_d: "AdFix audits visuals, copy, CTA, hierarchy and branding.",
    step3_t: "3. Regenerate",
    step3_d: "Get a brief + a new AI-generated creative.",
    language: "Language",
    spy_title: "Spy on competitor Meta Ads",
    spy_subtitle:
      "Describe your market: AdFix scans Meta Ad Library, finds competitor ads currently running and extracts the patterns that work.",
    spy_market_label: "Your market / niche",
    spy_market_placeholder: "e.g. online fitness coaching for women 30-45",
    spy_country_label: "Country",
    spy_run: "Spy on competitors",
    spy_running: "Scanning Meta Ad Library…",
    spy_market_required: "Describe your market first.",
    spy_market_summary: "Market overview",
    spy_patterns: "Winning patterns",
    spy_ads_found: "Competitor ads detected",
    spy_brief: "Inspired brief (copy-paste)",
    spy_open_library: "Open Meta Ad Library",
    spy_use_brief: "Use this brief",
  },
  es: {
    nav_cta: "Analizar mi creativo",
    hero_badge: "Auditoría IA de tus creativos publicitarios",
    hero_title_1: "¿Tus creativos no convierten?",
    hero_title_2: "AdFix los corrige.",
    hero_subtitle:
      "Arrastra tu anuncio. AdFix analiza jerarquía, legibilidad, CTA y branding, y genera una nueva versión optimizada.",
    drop_title: "Arrastra tu creativo aquí",
    drop_hint: "haz clic para buscar, o pega con ⌘/Ctrl+V — PNG, JPG, WebP — máx 8MB",
    platform: "Plataforma",
    goal: "Objetivo (opcional)",
    goal_placeholder: "Ej: generar leads B2B",
    notes: "Contexto / Notas (opcional)",
    notes_placeholder: "Público, oferta, requisitos de marca…",
    analyze: "Analizar creativo",
    analyzing: "Analizando…",
    no_image_error: "Arrastra primero un creativo.",
    errors_title: "Errores detectados",
    score: "Puntuación",
    new_creative: "Nuevo creativo",
    brief: "Brief",
    copy_brief: "Copiar brief",
    copied: "Copiado",
    generate_image: "Generar imagen",
    regenerate: "Regenerar",
    generating: "Generando…",
    detected_text: "Texto detectado",
    fix_label: "Corrección",
    step1_t: "1. Arrastra",
    step1_d: "Tu creativo publicitario (imagen, banner, post).",
    step2_t: "2. Analiza",
    step2_d: "AdFix audita visual, copy, CTA, jerarquía y branding.",
    step3_t: "3. Regenera",
    step3_d: "Recibe un brief + un nuevo creativo generado por IA.",
    language: "Idioma",
    spy_title: "Espía a tus competidores en Meta Ads",
    spy_subtitle:
      "Describe tu mercado: AdFix escanea Meta Ad Library, detecta los anuncios activos de la competencia y extrae los patrones que funcionan.",
    spy_market_label: "Tu mercado / nicho",
    spy_market_placeholder: "Ej: coaching fitness online para mujeres 30-45",
    spy_country_label: "País",
    spy_run: "Espiar a la competencia",
    spy_running: "Escaneando Meta Ad Library…",
    spy_market_required: "Describe primero tu mercado.",
    spy_market_summary: "Visión del mercado",
    spy_patterns: "Patrones ganadores",
    spy_ads_found: "Anuncios de la competencia detectados",
    spy_brief: "Brief inspirado (copy-paste)",
    spy_open_library: "Abrir Meta Ad Library",
    spy_use_brief: "Usar este brief",
  },
};
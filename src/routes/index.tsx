import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Copy,
  Check,
  Wand2,
  UploadCloud,
  X,
  ImageIcon,
  Search,
  ExternalLink,
  Target,
  Download,
  Crown,
  Star,
  Lock,
  Zap,
} from "lucide-react";
import { LiquidButton } from "@/components/ui/liquid-button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { analyzeAd, analyzeAccount, generateCreative, spyCompetitorAds } from "@/utils/adfix.functions";
import { CreativeAnalyzer } from "@/components/CreativeAnalyzer";
import logo from "@/assets/adfix-logo.webp";
import { t as I18N, LANGS, type Lang } from "@/lib/i18n";
import demoVideoUrl from "@/assets/adfix-demo.mp4?url";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import type { User } from "@supabase/supabase-js";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AdFix — Analysez vos créatives publicitaires avec l'IA" },
      {
        name: "description",
        content:
          "Glissez votre créative publicitaire. AdFix détecte les erreurs visuelles et génère une version optimisée.",
      },
      { property: "og:title", content: "AdFix — Optimisez vos créatives" },
      {
        property: "og:description",
        content: "Analyse IA de vos visuels publicitaires : erreurs détectées + nouvelle créative générée.",
      },
    ],
  }),
  component: Index,
});

type Issue = {
  title: string;
  severity: "low" | "medium" | "high";
  category: string;
  explanation: string;
  fix: string;
};

type AnalysisResult = {
  score: number;
  summary: string;
  detected_text: string;
  issues: Issue[];
  improved_brief: string;
  subscores?: {
    visual: number;
    copy: number;
    cta: number;
    branding: number;
    value_prop: number;
    conversion_potential: number;
  };
  target_audience?: string;
  predicted_ctr_impact?: string;
  hook_alternatives?: string[];
  ab_test_ideas?: string[];
};

const severityStyles: Record<Issue["severity"], string> = {
  high: "bg-brand/10 text-brand border-brand/20",
  medium: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  low: "bg-muted text-muted-foreground border-border",
};

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

function Index() {
  const analyze = useServerFn(analyzeAd);
  const generate = useServerFn(generateCreative);
  const spy = useServerFn(spyCompetitorAds);
  const analyzeAcc = useServerFn(analyzeAccount);
  const inputRef = useRef<HTMLInputElement>(null);

  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === "undefined") return "fr";
    const saved = window.localStorage.getItem("adfix-lang") as Lang | null;
    if (saved && ["fr", "en", "es"].includes(saved)) return saved;
    const nav = window.navigator.language?.slice(0, 2);
    if (nav === "en" || nav === "es") return nav;
    return "fr";
  });
  const tr = I18N[lang];
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("adfix-lang", lang);
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [platform, setPlatform] = useState("Meta (Facebook / Instagram)");
  const [goal, setGoal] = useState("");
  const [notes, setNotes] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  type ImageModel =
    | "google/gemini-2.5-flash-image"
    | "google/gemini-3.1-flash-image-preview"
    | "google/gemini-3-pro-image-preview";
  const IMAGE_MODELS: { id: ImageModel; label: string; sub: string; pro?: boolean }[] = [
    { id: "google/gemini-2.5-flash-image", label: "Nano Banana", sub: "Rapide • Standard" },
    { id: "google/gemini-3.1-flash-image-preview", label: "Nano Banana 2", sub: "Rapide • Pro quality", pro: true },
    { id: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro", sub: "Max qualité • Plus lent", pro: true },
  ];
  const [imageModel, setImageModel] = useState<ImageModel>("google/gemini-3-pro-image-preview");

  const [market, setMarket] = useState("");
  const [country, setCountry] = useState("FR");
  const [spying, setSpying] = useState(false);
  type SpyAd = { advertiser: string; hook: string; angle: string; cta: string; format: string; why_it_works: string; image_url?: string };
  type SpyPattern = { pattern: string; why_it_works: string; examples: string[] };
  type SpyResult = {
    market_summary: string;
    winning_patterns: SpyPattern[];
    ads: SpyAd[];
    copy_paste_brief: string;
  };
  const [spyResult, setSpyResult] = useState<SpyResult | null>(null);
  const [spyLibUrl, setSpyLibUrl] = useState<string | null>(null);
  const [spyImages, setSpyImages] = useState<string[]>([]);
  const [spyCopied, setSpyCopied] = useState(false);

  // ---- Account analysis (Pro) ----
  const accountInputRef = useRef<HTMLInputElement>(null);
  const [accountImage, setAccountImage] = useState<string | null>(null);
  const [accountFileName, setAccountFileName] = useState<string | null>(null);
  const [accountPlatform, setAccountPlatform] = useState("Instagram");
  const [accountNotes, setAccountNotes] = useState("");
  const [accountDragOver, setAccountDragOver] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  type AccountIssue = {
    title: string;
    severity: "low" | "medium" | "high";
    category: string;
    explanation: string;
    fix: string;
  };
  type AccountResult = {
    score: number;
    summary: string;
    detected_handle: string;
    strengths: string[];
    issues: AccountIssue[];
    recommendations: string;
  };
  const [accountResult, setAccountResult] = useState<AccountResult | null>(null);

  // ---- Splash loader ----
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashProgress, setSplashProgress] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let p = 0;
    const interval = setInterval(() => {
      p = Math.min(100, p + Math.random() * 14 + 6);
      setSplashProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setTimeout(() => setSplashVisible(false), 350);
      }
    }, 130);
    return () => clearInterval(interval);
  }, []);

  const handleAccountFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Format non supporté.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image trop lourde (max 8MB).");
      return;
    }
    try {
      const url = await fileToDataUrl(file);
      setAccountImage(url);
      setAccountFileName(file.name);
      setAccountResult(null);
    } catch {
      toast.error("Lecture du fichier impossible.");
    }
  }, []);

  const onAnalyzeAccount = async () => {
    if (!accountImage) {
      toast.error("Ajoutez un screenshot du compte.");
      return;
    }
    if (!requirePro("Analyse de compte")) return;
    setAccountLoading(true);
    setAccountResult(null);
    try {
      const res = await analyzeAcc({
        data: { imageDataUrl: accountImage, platform: accountPlatform, notes: accountNotes, lang },
      });
      if (!res.ok) toast.error(res.error);
      else setAccountResult(res.result as AccountResult);
    } catch (e) {
      console.error(e);
      toast.error("Error");
    } finally {
      setAccountLoading(false);
    }
  };

  // ---- Subscription / quota ----
  const FREE_LIMIT = 3;
  const [isPro, setIsPro] = useState(false);
  const [usage, setUsage] = useState(0);
  const [usageMonth, setUsageMonth] = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [pendingAnalyze, setPendingAnalyze] = useState(false);

  // ---- Auth ----
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Compte créé, vous êtes connecté.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        toast.success("Connecté.");
      }
      setShowAuth(false);
      setAuthEmail("");
      setAuthPassword("");
      if (pendingAnalyze) {
        setPendingAnalyze(false);
        setTimeout(() => runAnalyze(), 100);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur d'authentification");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    } catch (e: any) {
      toast.error(e?.message || "Erreur Google");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnecté");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsPro(window.localStorage.getItem("adfix-pro") === "1");
    const month = new Date().toISOString().slice(0, 7);
    const savedMonth = window.localStorage.getItem("adfix-usage-month");
    if (savedMonth !== month) {
      window.localStorage.setItem("adfix-usage-month", month);
      window.localStorage.setItem("adfix-usage", "0");
      setUsage(0);
      setUsageMonth(month);
    } else {
      setUsage(parseInt(window.localStorage.getItem("adfix-usage") || "0", 10));
      setUsageMonth(month);
    }
  }, []);

  const remaining = Math.max(0, FREE_LIMIT - usage);
  const canUseFree = isPro || remaining > 0;

  const consumeQuota = () => {
    if (isPro) return;
    const next = usage + 1;
    setUsage(next);
    window.localStorage.setItem("adfix-usage", String(next));
  };

  const requirePro = (feature: string) => {
    if (isPro) return true;
    setShowUpgrade(true);
    toast.error(`${feature} — réservé au plan Pro`);
    return false;
  };

  const activatePro = () => {
    window.localStorage.setItem("adfix-pro", "1");
    setIsPro(true);
    setShowUpgrade(false);
    toast.success("Bienvenue sur AdFix Pro 🎉");
    if (pendingAnalyze) {
      setPendingAnalyze(false);
      setTimeout(() => runAnalyze(), 100);
    }
  };

  const downloadImage = (dataUrl: string, name = "adfix-creative.png") => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Format non supporté. Utilisez une image (PNG, JPG, WebP).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image trop lourde (max 8MB).");
      return;
    }
    try {
      const url = await fileToDataUrl(file);
      setImageDataUrl(url);
      setFileName(file.name);
      setResult(null);
      setGeneratedImage(null);
    } catch {
      toast.error("Lecture du fichier impossible.");
    }
  }, []);

  // Coller une image depuis le presse-papiers (Ctrl/Cmd+V)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            const dt = new DataTransfer();
            dt.items.add(file);
            handleFiles(dt.files);
            toast.success("Image collée");
            return;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFiles]);

  const runAnalyze = async () => {
    if (!canUseFree) {
      setShowUpgrade(true);
      toast.error("Quota gratuit atteint (3/mois). Passez Pro pour continuer.");
      return;
    }
    setLoading(true);
    setResult(null);
    setGeneratedImage(null);
    try {
      const res = await analyze({ data: { imageDataUrl, platform, goal, notes, lang } });
      if (!res.ok) toast.error(res.error);
      else {
        setResult(res.result as AnalysisResult);
        consumeQuota();
      }
    } catch (e) {
      console.error(e);
      toast.error("Error");
    } finally {
      setLoading(false);
    }
  };

  const onAnalyze = async () => {
    if (!imageDataUrl) {
      toast.error(tr.no_image_error);
      return;
    }
    if (!user) {
      setPendingAnalyze(true);
      setShowAuth(true);
      toast.info("Connectez-vous pour analyser votre créative.");
      return;
    }
    if (!isPro) {
      setPendingAnalyze(true);
      setShowUpgrade(true);
      return;
    }
    await runAnalyze();
  };

  const continueFree = async () => {
    setShowUpgrade(false);
    if (pendingAnalyze) {
      setPendingAnalyze(false);
      await runAnalyze();
    }
  };

  const onGenerate = async () => {
    if (!result) return;
    if (!requirePro("Génération de créative IA")) return;
    setGenerating(true);
    setGeneratedImage(null);
    try {
      const res = await generate({ data: { brief: result.improved_brief, platform, lang, model: imageModel } });
      if (!res.ok) toast.error(res.error);
      else setGeneratedImage(res.imageDataUrl);
    } catch (e) {
      console.error(e);
      toast.error("Génération impossible.");
    } finally {
      setGenerating(false);
    }
  };

  const copyBrief = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.improved_brief);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const clearImage = () => {
    setImageDataUrl(null);
    setFileName(null);
    setResult(null);
    setGeneratedImage(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onSpy = async () => {
    if (!market.trim()) {
      toast.error(tr.spy_market_required);
      return;
    }
    if (!requirePro("Espionnage concurrents")) return;
    setSpying(true);
    setSpyResult(null);
    try {
      const res = await spy({ data: { market, country, lang } });
      if (!res.ok) {
        toast.error(res.error);
      } else {
        setSpyResult(res.result as SpyResult);
        setSpyLibUrl(res.adLibraryUrl ?? null);
        setSpyImages(res.imageUrls ?? []);
      }
    } catch (e) {
      console.error(e);
      toast.error("Error");
    } finally {
      setSpying(false);
    }
  };

  const useSpyBrief = () => {
    if (!spyResult) return;
    setNotes(spyResult.copy_paste_brief);
    toast.success("Brief ajouté aux notes");
    document.getElementById("analyzer")?.scrollIntoView({ behavior: "smooth" });
  };

  const copySpyBrief = async () => {
    if (!spyResult) return;
    await navigator.clipboard.writeText(spyResult.copy_paste_brief);
    setSpyCopied(true);
    setTimeout(() => setSpyCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-center" />

      {splashVisible && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-300"
          style={{ opacity: splashProgress >= 100 ? 0 : 1 }}
        >
          <h1 className="text-6xl sm:text-7xl font-bold tracking-tight mb-8 animate-pulse">
            AdFix
          </h1>
          <div className="w-56 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-brand transition-[width] duration-150 ease-out"
              style={{ width: `${splashProgress}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground tabular-nums">
            {Math.floor(splashProgress)}%
          </p>
        </div>
      )}

      <header className="border-b border-border/60 backdrop-blur-sm sticky top-0 z-40 bg-background/80">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src={logo} alt="AdFix" className="h-10 w-auto" />
          </a>
          <div className="flex items-center gap-2">
            {isPro ? (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 text-brand px-2.5 h-7 text-xs font-semibold">
                <Crown className="h-3.5 w-3.5" /> Pro
              </span>
            ) : (
              <button
                onClick={() => setShowUpgrade(true)}
                className="hidden sm:inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2.5 h-7 text-xs font-semibold text-muted-foreground hover:text-foreground"
                title="Quota gratuit"
              >
                {remaining}/{FREE_LIMIT} gratuits
              </button>
            )}
            {authReady && user && (
              <button
                onClick={handleLogout}
                className="hidden sm:inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2.5 h-7 text-xs font-semibold text-muted-foreground hover:text-foreground"
                title={user.email ?? ""}
              >
                Déconnexion
              </button>
            )}
            <div
              role="group"
              aria-label={tr.language}
              className="inline-flex items-center rounded-full border border-border bg-card/60 backdrop-blur p-0.5"
            >
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLang(l.code)}
                  className={`px-2.5 h-7 text-xs font-semibold rounded-full transition-colors ${
                    lang === l.code
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l.short}
                </button>
              ))}
            </div>
            <a href="#analyzer">
              <LiquidButton size="sm">
                <span className="hidden sm:inline">{tr.nav_cta}</span>
                <span className="sm:hidden">{tr.analyze}</span>
                <ArrowRight className="h-4 w-4 hidden sm:inline-block" />
              </LiquidButton>
            </a>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-subtle)" }} />
        <div className="mx-auto max-w-4xl px-6 pt-20 pb-14 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card text-xs text-muted-foreground mb-6">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            {tr.hero_badge}
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.1] text-balance">
            {tr.hero_title_1}
            <br />
            <span className="text-brand">{tr.hero_title_2}</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            {tr.hero_subtitle}
          </p>

          <div className="mt-10 mx-auto max-w-3xl">
            <div
              className="relative rounded-2xl overflow-hidden border border-border bg-card"
              style={{ boxShadow: "var(--shadow-soft)" }}
            >
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
                <video
                  src={demoVideoUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster=""
                  className="absolute inset-0 w-full h-full object-cover object-top"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="analyzer" className="mx-auto max-w-6xl px-6 pb-24">
        <CreativeAnalyzer />

        <div className="hidden" aria-hidden>
        <Card className="p-6 md:p-8 border-border/70" style={{ boxShadow: "var(--shadow-soft)" }}>
          {/* Dropzone — legacy analyzer */}
          {!imageDataUrl ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFiles(e.dataTransfer.files);
              }}
              className={`w-full rounded-xl border-2 border-dashed transition-all p-12 flex flex-col items-center justify-center text-center ${
                dragOver
                  ? "border-brand bg-brand/5"
                  : "border-border bg-muted/30 hover:bg-muted/60 hover:border-brand/40"
              }`}
            >
              <div className="h-14 w-14 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-4">
                <UploadCloud className="h-7 w-7" />
              </div>
              <p className="font-medium">{tr.drop_title}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {tr.drop_hint}
              </p>
            </button>
          ) : (
            <div className="grid md:grid-cols-[260px,1fr] gap-6 items-start">
              <div className="relative rounded-xl overflow-hidden border border-border bg-muted/30">
                <img src={imageDataUrl} alt="Créative" className="w-full h-auto object-contain" />
                <button
                  onClick={clearImage}
                  className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/90 border border-border flex items-center justify-center hover:bg-background"
                  aria-label="Retirer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                <span className="truncate">{fileName}</span>
              </div>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{tr.platform}</label>
              <Input value={platform} onChange={(e) => setPlatform(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{tr.goal}</label>
              <Input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder={tr.goal_placeholder}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="text-sm font-medium mb-1.5 block">{tr.notes}</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={tr.notes_placeholder}
              className="min-h-[80px]"
            />
          </div>

          <div className="mt-5 flex justify-end">
            <LiquidButton onClick={onAnalyze} disabled={loading || !imageDataUrl} size="lg">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {tr.analyzing}
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" /> {tr.analyze}
                </>
              )}
            </LiquidButton>
          </div>
        </Card>

        {result && (
          <div className="mt-10 grid lg:grid-cols-5 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="lg:col-span-3 p-6 border-border/70" style={{ boxShadow: "var(--shadow-soft)" }}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-brand" />
                  <h2 className="text-lg font-semibold">{tr.errors_title}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{tr.score}</span>
                  <span className="text-2xl font-semibold tabular-nums">{result.score}</span>
                  <span className="text-sm text-muted-foreground">/100</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{result.summary}</p>
              {result.subscores && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                  {Object.entries(result.subscores).map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-border bg-card/60 p-2 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{k.replace(/_/g, " ")}</div>
                      <div className="text-lg font-semibold tabular-nums">{v}</div>
                    </div>
                  ))}
                </div>
              )}
              {(result.target_audience || result.predicted_ctr_impact) && (
                <div className="grid sm:grid-cols-2 gap-2 mb-4 text-xs">
                  {result.target_audience && (
                    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                      <div className="font-semibold text-muted-foreground mb-0.5">Audience cible</div>
                      <div>{result.target_audience}</div>
                    </div>
                  )}
                  {result.predicted_ctr_impact && (
                    <div className="rounded-lg border border-brand/30 bg-brand/5 p-2.5">
                      <div className="font-semibold text-brand mb-0.5">Impact CTR estimé</div>
                      <div>{result.predicted_ctr_impact}</div>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-3">
                {result.issues.map((it, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-card p-4 hover:border-brand/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-medium text-sm">{it.title}</h3>
                      <Badge variant="outline" className={severityStyles[it.severity]}>
                        {it.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{it.explanation}</p>
                    <div className="text-sm flex gap-2 items-start">
                      <CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                      <span>
                        <span className="font-medium">{tr.fix_label} :</span> {it.fix}
                      </span>
                    </div>
                    {(it as any).impact && (
                      <div className="mt-2 text-xs inline-flex items-center gap-1 rounded-full bg-brand/10 text-brand px-2 py-0.5">
                        <Zap className="h-3 w-3" /> {(it as any).impact}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {(result.hook_alternatives?.length || result.ab_test_ideas?.length) && (
                <div className="mt-5 grid sm:grid-cols-2 gap-3">
                  {result.hook_alternatives && result.hook_alternatives.length > 0 && (
                    <div className="rounded-lg border border-border bg-card p-3">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Hooks alternatifs</div>
                      <ul className="space-y-1 text-sm">
                        {result.hook_alternatives.map((h, i) => (
                          <li key={i} className="flex gap-2"><Sparkles className="h-3.5 w-3.5 text-brand mt-1 shrink-0" /><span>{h}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.ab_test_ideas && result.ab_test_ideas.length > 0 && (
                    <div className="rounded-lg border border-border bg-card p-3">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">A/B tests prioritaires</div>
                      <ul className="space-y-1 text-sm">
                        {result.ab_test_ideas.map((h, i) => (
                          <li key={i} className="flex gap-2"><Target className="h-3.5 w-3.5 text-brand mt-1 shrink-0" /><span>{h}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card
              className="lg:col-span-2 p-6 border-brand/30 relative overflow-hidden"
              style={{ boxShadow: "var(--shadow-brand)" }}
            >
              <div
                className="absolute inset-0 opacity-[0.04] -z-0"
                style={{ background: "var(--gradient-brand)" }}
              />
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-brand" />
                  <h2 className="text-lg font-semibold">{tr.new_creative}</h2>
                  <span className="ml-1 inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 border border-amber-500/30">
                    Beta
                  </span>
                </div>

                <p className="text-xs text-muted-foreground mb-3 -mt-2">
                  La régénération d'image est en <span className="font-semibold text-foreground">beta</span> — la qualité peut varier, n'hésitez pas à régénérer plusieurs fois.
                </p>

                {generatedImage ? (
                  <div className="rounded-lg overflow-hidden border border-border bg-background aspect-square">
                    <img src={generatedImage} alt="Créative générée" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="rounded-lg bg-background border border-border p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-[280px] overflow-y-auto">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{tr.brief}</p>
                    {result.improved_brief}
                  </div>
                )}

                <div className="mt-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Moteur IA pour la génération
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {IMAGE_MODELS.map((m) => {
                      const active = imageModel === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setImageModel(m.id)}
                          className={`text-left rounded-lg border p-2.5 transition-colors ${
                            active
                              ? "border-brand bg-brand/5"
                              : "border-border bg-card hover:border-brand/40"
                          }`}
                        >
                          <div className="flex items-center gap-1 text-xs font-semibold">
                            {m.label}
                            {m.pro && <Crown className="h-3 w-3 text-brand" />}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <LiquidButton onClick={copyBrief} variant="ghost" fullWidth>
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" /> {tr.copied}
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> {tr.copy_brief}
                      </>
                    )}
                  </LiquidButton>
                  <LiquidButton onClick={onGenerate} disabled={generating} fullWidth>
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> {tr.generating}
                      </>
                    ) : (
                      <>
                        {isPro ? <Wand2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        {generatedImage ? tr.regenerate : tr.generate_image}
                      </>
                    )}
                  </LiquidButton>
                  {generatedImage && (
                    <LiquidButton
                      onClick={() => downloadImage(generatedImage, `adfix-${Date.now()}.png`)}
                      variant="outline"
                      fullWidth
                    >
                      <Download className="h-4 w-4" /> Télécharger (1:1)
                    </LiquidButton>
                  )}
                </div>

                {result.detected_text && (
                  <div className="mt-4 text-xs text-muted-foreground">
                    <span className="font-medium">{tr.detected_text} :</span> {result.detected_text}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {!result && !loading && (
          <div className="mt-10 grid md:grid-cols-3 gap-4">
            {[
              { t: tr.step1_t, d: tr.step1_d },
              { t: tr.step2_t, d: tr.step2_d },
              { t: tr.step3_t, d: tr.step3_d },
            ].map((s) => (
              <div key={s.t} className="p-5 rounded-xl border border-border bg-card">
                <h3 className="font-medium mb-1">{s.t}</h3>
                <p className="text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        )}
        </div>
      </section>

      <section id="spy" className="mx-auto max-w-6xl px-6 pb-24">
        <Card className="p-6 md:p-8 border-border/70" style={{ boxShadow: "var(--shadow-soft)" }}>
          <div className="flex items-start gap-3 mb-5">
            <div className="h-10 w-10 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{tr.spy_title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{tr.spy_subtitle}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-[1fr,140px] gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{tr.spy_market_label}</label>
              <Input
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                placeholder={tr.spy_market_placeholder}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{tr.spy_country_label}</label>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="FR"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <LiquidButton onClick={onSpy} disabled={spying || !market.trim()} size="lg">
              {spying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {tr.spy_running}
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" /> {tr.spy_run}
                </>
              )}
            </LiquidButton>
          </div>

          {spyResult && (
            <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {tr.spy_market_summary}
                </h3>
                <p className="text-sm leading-relaxed">{spyResult.market_summary}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {tr.spy_patterns}
                </h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {spyResult.winning_patterns.map((p, i) => (
                    <div key={i} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-4 w-4 text-brand" />
                        <h4 className="font-medium text-sm">{p.pattern}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">{p.why_it_works}</p>
                      {p.examples?.length > 0 && (
                        <ul className="mt-2 text-xs text-muted-foreground space-y-1 list-disc list-inside">
                          {p.examples.slice(0, 3).map((ex, j) => (
                            <li key={j}>{ex}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {tr.spy_ads_found}
                </h3>
                <div className="space-y-3">
                  {spyResult.ads.map((ad, i) => (
                    <div key={i} className="rounded-lg border border-border bg-card p-4 grid sm:grid-cols-[140px,1fr] gap-4">
                      {ad.image_url ? (
                        <a href={ad.image_url} target="_blank" rel="noopener noreferrer" className="block">
                          <img
                            src={ad.image_url}
                            alt={ad.advertiser}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-full h-[140px] object-cover rounded-md border border-border bg-muted"
                            onError={(e) => {
                              (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                            }}
                          />
                        </a>
                      ) : (
                        <div className="w-full h-[140px] rounded-md border border-dashed border-border bg-muted/30 flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h4 className="font-medium text-sm">{ad.advertiser}</h4>
                          <Badge variant="outline" className="text-xs">{ad.format}</Badge>
                        </div>
                        <p className="text-sm mb-1">
                          <span className="font-medium">Hook :</span> {ad.hook}
                        </p>
                        <p className="text-sm text-muted-foreground mb-1">
                          <span className="font-medium text-foreground">Angle :</span> {ad.angle}
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <span className="font-medium text-foreground">CTA :</span> {ad.cta}
                        </p>
                        <div className="text-sm flex gap-2 items-start">
                          <CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{ad.why_it_works}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {spyImages.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      Galerie ({spyImages.length})
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {spyImages.slice(0, 18).map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={url}
                            alt={`Creative ${i + 1}`}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-full aspect-square object-cover rounded-md border border-border bg-muted hover:opacity-80 transition-opacity"
                            onError={(e) => {
                              (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                            }}
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-brand/30 bg-brand/5 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {tr.spy_brief}
                </h3>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{spyResult.copy_paste_brief}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <LiquidButton onClick={copySpyBrief} variant="ghost" size="sm">
                    {spyCopied ? (
                      <>
                        <Check className="h-4 w-4" /> {tr.copied}
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> {tr.copy_brief}
                      </>
                    )}
                  </LiquidButton>
                  <LiquidButton onClick={useSpyBrief} size="sm">
                    <Wand2 className="h-4 w-4" /> {tr.spy_use_brief}
                  </LiquidButton>
                  {spyLibUrl && (
                    <a href={spyLibUrl} target="_blank" rel="noopener noreferrer">
                      <LiquidButton variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4" /> {tr.spy_open_library}
                      </LiquidButton>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* Account analyzer (Pro) */}
      <section id="account-analyzer" className="mx-auto max-w-6xl px-6 pb-24">
        <Card className="p-6 md:p-8 border-border/70" style={{ boxShadow: "var(--shadow-soft)" }}>
          <div className="flex items-start gap-3 mb-5">
            <div className="h-10 w-10 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0">
              <Crown className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-semibold">Analyser le compte de l'annonceur</h2>
                <Badge className="bg-brand/10 text-brand border-brand/20" variant="outline">
                  Pro
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Importez un screenshot du profil (Instagram, TikTok, Facebook, LinkedIn). L'IA évalue
                la crédibilité, la cohérence et l'alignement avec l'ad.
              </p>
            </div>
          </div>

          {!accountImage ? (
            <button
              type="button"
              onClick={() => accountInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setAccountDragOver(true);
              }}
              onDragLeave={() => setAccountDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setAccountDragOver(false);
                handleAccountFiles(e.dataTransfer.files);
              }}
              className={`w-full rounded-xl border-2 border-dashed transition-all p-10 flex flex-col items-center justify-center text-center ${
                accountDragOver
                  ? "border-brand bg-brand/5"
                  : "border-border bg-muted/30 hover:bg-muted/60 hover:border-brand/40"
              }`}
            >
              <div className="h-12 w-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-3">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="font-medium">Déposez le screenshot du compte</p>
              <p className="text-sm text-muted-foreground mt-1">
                PNG, JPG ou WebP — jusqu'à 8MB
              </p>
            </button>
          ) : (
            <div className="grid md:grid-cols-[260px,1fr] gap-6 items-start">
              <div className="relative rounded-xl overflow-hidden border border-border bg-muted/30">
                <img src={accountImage} alt="Compte" className="w-full h-auto object-contain" />
                <button
                  onClick={() => {
                    setAccountImage(null);
                    setAccountFileName(null);
                    setAccountResult(null);
                    if (accountInputRef.current) accountInputRef.current.value = "";
                  }}
                  className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/90 border border-border flex items-center justify-center hover:bg-background"
                  aria-label="Retirer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                <span className="truncate">{accountFileName}</span>
              </div>
            </div>
          )}
          <input
            ref={accountInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => handleAccountFiles(e.target.files)}
          />

          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Plateforme</label>
              <Input
                value={accountPlatform}
                onChange={(e) => setAccountPlatform(e.target.value)}
                placeholder="Instagram, TikTok, Facebook…"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes (optionnel)</label>
              <Input
                value={accountNotes}
                onChange={(e) => setAccountNotes(e.target.value)}
                placeholder="Contexte sur la marque, l'offre…"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <LiquidButton onClick={onAnalyzeAccount} disabled={accountLoading || !accountImage} size="lg">
              {accountLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analyse…
                </>
              ) : (
                <>
                  {isPro ? <Wand2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  Analyser le compte
                </>
              )}
            </LiquidButton>
          </div>

          {accountResult && (
            <div className="mt-8 grid lg:grid-cols-5 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="lg:col-span-3 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-brand" />
                    <h3 className="text-lg font-semibold">Points à améliorer</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Crédibilité</span>
                    <span className="text-2xl font-semibold tabular-nums">{accountResult.score}</span>
                    <span className="text-sm text-muted-foreground">/100</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{accountResult.summary}</p>
                {accountResult.issues.map((it, i) => (
                  <div key={i} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="font-medium text-sm">{it.title}</h4>
                      <Badge variant="outline" className={severityStyles[it.severity]}>
                        {it.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{it.explanation}</p>
                    <div className="text-sm flex gap-2 items-start">
                      <CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                      <span><span className="font-medium">Fix :</span> {it.fix}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="lg:col-span-2 space-y-4">
                {accountResult.strengths?.length > 0 && (
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Points forts
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      {accountResult.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="rounded-lg border border-brand/30 bg-brand/5 p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Plan d'action
                  </h4>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{accountResult.recommendations}</p>
                </div>
                {accountResult.detected_handle && (
                  <p className="text-xs text-muted-foreground">
                    Compte détecté : <span className="font-medium">{accountResult.detected_handle}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* Social proof */}
      <section id="social-proof" className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="text-center mb-10">
            <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 mb-3">
              <div className="inline-flex items-center gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
                <Star className="h-4 w-4 fill-amber-400/60 text-amber-400" />
              </div>
              <span className="text-sm font-semibold">4,7/5</span>
              <span className="text-sm text-muted-foreground">— retours des premiers utilisateurs</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Ce qu'en disent les marketeurs qui l'ont testé
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              AdFix est encore jeune — voici les retours bruts d'une poignée d'early users.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { n: "~1 200", l: "créatives analysées" },
              { n: "+22%", l: "CTR moyen rapporté" },
              { n: "−15%", l: "CPA moyen rapporté" },
              { n: "180+", l: "early users actifs" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl border border-border bg-card p-5 text-center">
                <div className="text-2xl font-semibold text-brand">{s.n}</div>
                <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{s.l}</div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                q: "Honnêtement j'étais sceptique au début. J'ai balancé une créa qui tournait depuis 2 mois, AdFix m'a sorti 4 trucs que j'avais zappés (le CTA était illisible sur mobile…). Refait la version, +18% de CTR la semaine d'après. Pour 15€/mois je dis ok.",
                a: "Julien M.",
                r: "Freelance media buyer · Lyon",
                avatar: "https://i.pravatar.cc/96?img=12",
                stars: 5,
              },
              {
                q: "Très utile pour itérer vite quand t'as pas de DA sous la main. La génération d'image est pas toujours parfaite (faut souvent regen 2-3 fois) mais le brief est solide. Je l'utilise surtout en phase de test.",
                a: "Sarah B.",
                r: "Growth chez une marque DTC",
                avatar: "https://i.pravatar.cc/96?img=47",
                stars: 4,
              },
              {
                q: "Le spy concurrent c'est ce qui m'a convaincu. Je passais des heures dans la Meta Ad Library, là j'ai un résumé clean en 30 secondes. Bon outil pour les solos qui gèrent leur propre pub.",
                a: "Thomas K.",
                r: "Fondateur e-commerce",
                avatar: "https://i.pravatar.cc/96?img=33",
                stars: 5,
              },
            ].map((t) => (
              <div key={t.a} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${i < t.stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm leading-relaxed mb-4">« {t.q} »</p>
                <div className="flex items-center gap-3">
                  <img
                    src={t.avatar}
                    alt={t.a}
                    loading="lazy"
                    className="h-10 w-10 rounded-full object-cover border border-border"
                  />
                  <div className="text-xs">
                    <div className="font-semibold">{t.a}</div>
                    <div className="text-muted-foreground">{t.r}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Choisissez votre plan
            </h2>
            <p className="mt-3 text-muted-foreground">Commencez gratuitement, passez Pro quand vous êtes prêt.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <Card className="p-6 border-border/70">
              <h3 className="text-lg font-semibold">Free</h3>
              <p className="text-sm text-muted-foreground mt-1">Pour tester AdFix</p>
              <div className="mt-4 mb-5">
                <span className="text-4xl font-semibold">0€</span>
                <span className="text-muted-foreground"> / mois</span>
              </div>
              <ul className="space-y-2 text-sm">
                {[
                  "3 analyses de créatives / mois",
                  "Détection des erreurs visuelles",
                  "Brief d'amélioration détaillé",
                  "Support communautaire",
                ].map((f) => (
                  <li key={f} className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <LiquidButton variant="ghost" fullWidth disabled={!isPro}>
                  {isPro ? "Plan actif (Pro)" : "Plan actuel"}
                </LiquidButton>
              </div>
            </Card>

            <Card
              className="p-6 border-brand/40 relative overflow-hidden"
              style={{ boxShadow: "var(--shadow-brand)" }}
            >
              <div className="absolute inset-0 opacity-[0.05] -z-0" style={{ background: "var(--gradient-brand)" }} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold inline-flex items-center gap-2">
                    <Crown className="h-5 w-5 text-brand" /> Pro
                  </h3>
                  <Badge className="bg-brand text-white border-brand">Populaire</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Pour scaler vos ads</p>
                <div className="mt-4 mb-5">
                  <span className="text-4xl font-semibold">14,99€</span>
                  <span className="text-muted-foreground"> / mois</span>
                </div>
                <ul className="space-y-2 text-sm">
                  {[
                    "Analyses illimitées",
                    "Génération de créatives IA (format Instagram 1:1)",
                    "Téléchargement HD sans watermark",
                    "Spy concurrents Meta Ad Library",
                    "Brief copy-paste prêt à l'emploi",
                    "Multi-langues (FR/EN/ES)",
                    "Support prioritaire",
                  ].map((f) => (
                    <li key={f} className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isPro ? (
                    <LiquidButton variant="ghost" fullWidth disabled>
                      <Check className="h-4 w-4" /> Vous êtes Pro
                    </LiquidButton>
                  ) : (
                    <LiquidButton onClick={() => setShowUpgrade(true)} fullWidth>
                      <Zap className="h-4 w-4" /> Passer Pro
                    </LiquidButton>
                  )}
                </div>
              </div>
            </Card>

            <Card
              className="p-6 border-brand/60 relative overflow-hidden"
              style={{ boxShadow: "var(--shadow-brand)" }}
            >
              <div className="absolute inset-0 opacity-[0.08] -z-0" style={{ background: "var(--gradient-brand)" }} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold inline-flex items-center gap-2">
                    <Crown className="h-5 w-5 text-brand" /> Lifetime
                  </h3>
                  <Badge className="bg-brand text-white border-brand">-55%</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Paiement unique, accès à vie</p>
                <div className="mt-4 mb-5 flex items-baseline gap-2">
                  <span className="text-4xl font-semibold">89,99€</span>
                  <span className="text-muted-foreground line-through text-lg">199€</span>
                </div>
                <ul className="space-y-2 text-sm">
                  {[
                    "Tout le plan Pro inclus",
                    "Accès illimité à vie",
                    "Toutes les futures mises à jour",
                    "Aucun renouvellement",
                    "Support prioritaire VIP",
                    "Offre de lancement",
                  ].map((f) => (
                    <li key={f} className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isPro ? (
                    <LiquidButton variant="ghost" fullWidth disabled>
                      <Check className="h-4 w-4" /> Vous êtes Pro
                    </LiquidButton>
                  ) : (
                    <LiquidButton onClick={() => setShowUpgrade(true)} fullWidth>
                      <Crown className="h-4 w-4" /> Obtenir l'accès à vie
                    </LiquidButton>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Auth Modal */}
      {showAuth && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setShowAuth(false)}
        >
          <Card
            className="max-w-md w-full p-6 border-border relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowAuth(false)}
              className="absolute top-3 right-3 h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-xl font-semibold mb-1">
              {authMode === "login" ? "Connexion" : "Créer un compte"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Connectez-vous pour analyser vos créatives.
            </p>
            <button
              type="button"
              onClick={handleGoogle}
              className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium mb-3"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continuer avec Google
            </button>
            <div className="flex items-center gap-2 my-3 text-xs text-muted-foreground">
              <div className="flex-1 h-px bg-border" /> ou <div className="flex-1 h-px bg-border" />
            </div>
            <form onSubmit={handleEmailAuth} className="space-y-3">
              <Input
                type="email"
                placeholder="vous@exemple.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Mot de passe"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
                minLength={6}
              />
              <LiquidButton type="submit" fullWidth disabled={authLoading}>
                {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {authMode === "login" ? "Se connecter" : "Créer le compte"}
              </LiquidButton>
            </form>
            <button
              type="button"
              onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
              className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              {authMode === "login" ? "Pas de compte ? Créer un compte" : "Déjà inscrit ? Se connecter"}
            </button>
          </Card>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgrade && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setShowUpgrade(false)}
        >
          <Card
            className="max-w-md w-full p-6 border-brand/40 relative"
            style={{ boxShadow: "var(--shadow-brand)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowUpgrade(false)}
              className="absolute top-3 right-3 h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="h-12 w-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-4">
              <Crown className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold mb-1">Débloquez AdFix Pro</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Analyses illimitées, génération de créatives Instagram, spy concurrents et téléchargement HD.
            </p>
            <ul className="space-y-2 text-sm mb-5">
              {[
                "Analyses créatives illimitées",
                "Génération IA format 1:1 + téléchargement",
                "Spy concurrents Meta",
                "Multi-langues + support prioritaire",
              ].map((f) => (
                <li key={f} className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-semibold">14,99€</span>
              <span className="text-sm text-muted-foreground">/ mois</span>
              <span className="text-sm text-muted-foreground line-through ml-2">29€</span>
            </div>
            <LiquidButton onClick={activatePro} fullWidth size="lg">
              <Zap className="h-4 w-4" /> Activer Pro — 14,99€/mois
            </LiquidButton>
            {!isPro && remaining > 0 && (
              <button
                onClick={continueFree}
                className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                {pendingAnalyze
                  ? `Continuer l'analyse en Free (${remaining}/${FREE_LIMIT} restantes)`
                  : `Rester en Free (${remaining}/${FREE_LIMIT} restantes)`}
              </button>
            )}
            <p className="text-[11px] text-muted-foreground text-center mt-3">
              Sans engagement — résiliez à tout moment.
            </p>
          </Card>
        </div>
      )}

      <section className="border-t border-border/60 py-16 bg-gradient-to-b from-transparent to-muted/20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/30 to-primary/5 border border-border/60 flex items-center justify-center text-2xl font-semibold">
              T
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Le créateur</p>
              <h2 className="text-2xl font-semibold mt-1">Théo — fondateur d'AdFix</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              Après avoir lancé des dizaines de campagnes Meta Ads pour mes propres projets et pour des clients,
              j'ai constaté la même chose à chaque fois : <span className="text-foreground">90% des créatives échouent à
              cause de détails évitables</span> — hiérarchie cassée, CTA invisible, copy faible, branding flou.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              J'ai créé AdFix pour donner à chaque marketeur, freelance ou e-commerçant un copilote IA capable
              d'auditer une créative en quelques secondes et de proposer une version qui convertit vraiment.
              L'objectif : arrêter de cramer du budget pub à cause d'erreurs visuelles.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={logo} alt="AdFix" className="h-6 w-auto opacity-80" />
          </div>
          <p>© {new Date().getFullYear()} AdFix — Créé avec passion par Théo</p>
        </div>
      </footer>
    </div>
  );
}

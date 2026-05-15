import { useCallback, useRef, useState } from "react";
import {
  UploadCloud,
  X,
  ImageIcon,
  Loader2,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LiquidButton } from "@/components/ui/liquid-button";
import { toast } from "sonner";

export type CreativeAnalysisResult = {
  score: number;
  strengths: string[];
  weaknesses: string[];
  criteria: { name: string; score: number; max: number; tip: string }[];
};

const MAX_BYTES = 8 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function scoreRingColor(score: number): string {
  if (score >= 75) return "stroke-emerald-500";
  if (score >= 50) return "stroke-amber-500";
  return "stroke-red-500";
}

export function CreativeAnalyzer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreativeAnalysisResult | null>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Format non supporté. Utilisez PNG, JPG ou WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image trop lourde (max 8 Mo).");
      return;
    }
    try {
      const url = await fileToDataUrl(file);
      setImageDataUrl(url);
      setFileName(file.name);
      setResult(null);
    } catch {
      toast.error("Impossible de lire le fichier.");
    }
  }, []);

  const clearImage = () => {
    setImageDataUrl(null);
    setFileName(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onAnalyze = async () => {
    if (!imageDataUrl) {
      toast.error("Ajoutez une image avant d'analyser.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke<CreativeAnalysisResult>(
        "analyze-creative",
        { body: { image: imageDataUrl } },
      );

      if (error) throw error;

      if (data && "error" in data && typeof (data as { error: string }).error === "string") {
        throw new Error((data as { error: string }).error);
      }

      if (!data || typeof data.score !== "number") {
        throw new Error("Réponse invalide du serveur.");
      }

      setResult(data);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Erreur lors de l'analyse.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const circumference = 2 * Math.PI * 54;
  const scoreOffset = result ? circumference - (result.score / 100) * circumference : circumference;

  return (
    <div className="space-y-8">
      <Card className="p-6 md:p-8 border-border/70" style={{ boxShadow: "var(--shadow-soft)" }}>
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
            <p className="font-medium">Glissez votre créative ici</p>
            <p className="text-sm text-muted-foreground mt-1">PNG, JPG ou WebP — max 8 Mo</p>
          </button>
        ) : (
          <div className="grid md:grid-cols-[260px,1fr] gap-6 items-start">
            <div className="relative rounded-xl overflow-hidden border border-border bg-muted/30">
              <img src={imageDataUrl} alt="Créative" className="w-full h-auto object-contain" />
              <button
                type="button"
                onClick={clearImage}
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/90 border border-border flex items-center justify-center hover:bg-background"
                aria-label="Retirer l'image"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
              <ImageIcon className="h-4 w-4 shrink-0" />
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

        <div className="mt-5 flex justify-end">
          <LiquidButton onClick={onAnalyze} disabled={loading || !imageDataUrl} size="lg">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analyse en cours…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" /> Analyser la créative
              </>
            )}
          </LiquidButton>
        </div>
      </Card>

      {result && (
        <div className="grid lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card
            className="lg:col-span-1 p-6 flex flex-col items-center justify-center border-border/70"
            style={{ boxShadow: "var(--shadow-soft)" }}
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Score global</p>
            <div className="relative h-36 w-36">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted/40"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={scoreOffset}
                  className={scoreRingColor(result.score)}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-4xl font-bold tabular-nums ${scoreColor(result.score)}`}>
                  {result.score}
                </span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
            </div>
          </Card>

          <Card
            className="lg:col-span-2 p-6 border-border/70"
            style={{ boxShadow: "var(--shadow-soft)" }}
          >
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-semibold text-emerald-700">Points forts</h3>
                </div>
                <ul className="space-y-2">
                  {result.strengths.map((s, i) => (
                    <li
                      key={i}
                      className="text-sm rounded-lg border border-emerald-200/80 bg-emerald-50/80 dark:bg-emerald-950/30 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-200 px-3 py-2"
                    >
                      {s}
                    </li>
                  ))}
                  {result.strengths.length === 0 && (
                    <li className="text-sm text-muted-foreground">Aucun point fort identifié.</li>
                  )}
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <h3 className="font-semibold text-red-700">Points faibles</h3>
                </div>
                <ul className="space-y-2">
                  {result.weaknesses.map((w, i) => (
                    <li
                      key={i}
                      className="text-sm rounded-lg border border-red-200/80 bg-red-50/80 dark:bg-red-950/30 dark:border-red-800/50 text-red-800 dark:text-red-200 px-3 py-2"
                    >
                      {w}
                    </li>
                  ))}
                  {result.weaknesses.length === 0 && (
                    <li className="text-sm text-muted-foreground">Aucun point faible identifié.</li>
                  )}
                </ul>
              </div>
            </div>
          </Card>

          <Card
            className="lg:col-span-3 p-6 border-border/70"
            style={{ boxShadow: "var(--shadow-soft)" }}
          >
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="h-5 w-5 text-brand" />
              <h3 className="text-lg font-semibold">Détail par critère</h3>
            </div>
            <div className="space-y-5">
              {result.criteria.map((c, i) => (
                <div key={i} className="rounded-lg border border-border bg-card/60 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="font-medium text-sm">{c.name}</span>
                    <span className="text-sm tabular-nums text-muted-foreground shrink-0">
                      {c.score} / {c.max}
                    </span>
                  </div>
                  <Progress value={(c.score / c.max) * 100} className="h-2 mb-2" />
                  <p className="text-sm text-muted-foreground">{c.tip}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

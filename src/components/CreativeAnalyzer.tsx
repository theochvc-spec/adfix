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
  Video,
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
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

function extractVideoFrames(file: File, frameCount = 5): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.src = url;
    video.muted = true;
    video.playsInline = true;

    video.addEventListener("loadedmetadata", () => {
      const duration = video.duration;
      const frames: string[] = [];
      let captured = 0;

      const captureFrame = (time: number) => {
        video.currentTime = time;
      };

      const onSeeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          frames.push(canvas.toDataURL("image/jpeg", 0.7));
        }
        captured++;
        if (captured < frameCount) {
          captureFrame((duration / frameCount) * captured);
        } else {
          URL.revokeObjectURL(url);
          resolve(frames);
        }
      };

      video.addEventListener("seeked", onSeeked, { once: false });
      captureFrame(0);
    });

    video.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire la vidéo."));
    });
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

type MediaType = "image" | "video";

export function CreativeAnalyzer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<CreativeAnalysisResult | null>(null);

  const handleImageFile = useCallback(async (file: File) => {
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
      setVideoFrames([]);
      setFileName(file.name);
      setResult(null);
    } catch {
      toast.error("Impossible de lire le fichier.");
    }
  }, []);

  const handleVideoFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Format non supporté. Utilisez MP4, MOV ou WebM.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error("Vidéo trop lourde (max 50 Mo).");
      return;
    }
    setExtracting(true);
    setResult(null);
    setImageDataUrl(null);
    setVideoFrames([]);
    setFileName(file.name);
    try {
      const frames = await extractVideoFrames(file, 5);
      setVideoFrames(frames);
      toast.success(`${frames.length} frames extraites de la vidéo.`);
    } catch (e) {
      toast.error("Impossible d'extraire les frames de la vidéo.");
    } finally {
      setExtracting(false);
    }
  }, []);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (mediaType === "image") {
      await handleImageFile(file);
    } else {
      await handleVideoFile(file);
    }
  }, [mediaType, handleImageFile, handleVideoFile]);

  const clearMedia = () => {
    setImageDataUrl(null);
    setVideoFrames([]);
    setFileName(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const hasMedia = imageDataUrl !== null || videoFrames.length > 0;

  const onAnalyze = async () => {
    if (!hasMedia) {
      toast.error("Ajoutez un fichier avant d'analyser.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const body = videoFrames.length > 0
        ? { image: videoFrames[0], frames: videoFrames, isVideo: true }
        : { image: imageDataUrl };

      const { data, error } = await supabase.functions.invoke<CreativeAnalysisResult>(
        "analyze-creative",
        { body },
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

  const accept = mediaType === "image"
    ? "image/png,image/jpeg,image/webp,image/gif"
    : "video/mp4,video/quicktime,video/webm,video/*";

  return (
    <div className="space-y-8">
      <Card className="p-6 md:p-8 border-border/70" style={{ boxShadow: "var(--shadow-soft)" }}>

        {/* Toggle image / vidéo */}
        <div className="inline-flex items-center rounded-full border border-border bg-card/60 p-0.5 mb-6">
          <button
            type="button"
            onClick={() => { setMediaType("image"); clearMedia(); }}
            className={`px-4 h-8 text-sm font-medium rounded-full transition-colors flex items-center gap-2 ${
              mediaType === "image" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ImageIcon className="h-4 w-4" /> Image
          </button>
          <button
            type="button"
            onClick={() => { setMediaType("video"); clearMedia(); }}
            className={`px-4 h-8 text-sm font-medium rounded-full transition-colors flex items-center gap-2 ${
              mediaType === "video" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Video className="h-4 w-4" /> Vidéo
          </button>
        </div>

        {!hasMedia ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            className={`w-full rounded-xl border-2 border-dashed transition-all p-12 flex flex-col items-center justify-center text-center ${
              dragOver ? "border-brand bg-brand/5" : "border-border bg-muted/30 hover:bg-muted/60 hover:border-brand/40"
            }`}
          >
            <div className="h-14 w-14 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-4">
              {mediaType === "image" ? <UploadCloud className="h-7 w-7" /> : <Video className="h-7 w-7" />}
            </div>
            <p className="font-medium">
              {mediaType === "image" ? "Glissez votre créative ici" : "Glissez votre vidéo publicitaire ici"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {mediaType === "image" ? "PNG, JPG ou WebP — max 8 Mo" : "MP4, MOV ou WebM — max 50 Mo"}
            </p>
          </button>
        ) : extracting ? (
          <div className="w-full rounded-xl border border-border bg-muted/30 p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
            <p className="text-sm text-muted-foreground">Extraction des frames en cours…</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {mediaType === "image" ? <ImageIcon className="h-4 w-4 shrink-0" /> : <Video className="h-4 w-4 shrink-0" />}
              <span className="truncate">{fileName}</span>
              <button
                type="button"
                onClick={clearMedia}
                className="ml-auto h-7 w-7 rounded-full border border-border flex items-center justify-center hover:bg-muted"
                aria-label="Retirer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {imageDataUrl && (
              <div className="relative rounded-xl overflow-hidden border border-border bg-muted/30 max-w-[260px]">
                <img src={imageDataUrl} alt="Créative" className="w-full h-auto object-contain" />
              </div>
            )}

            {videoFrames.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">{videoFrames.length} frames extraites :</p>
                <div className="grid grid-cols-5 gap-2">
                  {videoFrames.map((frame, i) => (
                    <div key={i} className="rounded-lg overflow-hidden border border-border bg-muted/30 aspect-video">
                      <img src={frame} alt={`Frame ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="mt-5 flex justify-end">
          <LiquidButton onClick={onAnalyze} disabled={loading || !hasMedia || extracting} size="lg">
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Analyse en cours…</>
            ) : (
              <><Wand2 className="h-4 w-4" /> Analyser {mediaType === "video" ? "la vidéo" : "la créative"}</>
            )}
          </LiquidButton>
        </div>
      </Card>

      {result && (
        <div className="grid lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="lg:col-span-1 p-6 flex flex-col items-center justify-center border-border/70" style={{ boxShadow: "var(--shadow-soft)" }}>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Score global</p>
            <div className="relative h-36 w-36">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/40" />
                <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={scoreOffset} className={scoreRingColor(result.score)} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-4xl font-bold tabular-nums ${scoreColor(result.score)}`}>{result.score}</span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
            </div>
          </Card>

          <Card className="lg:col-span-2 p-6 border-border/70" style={{ boxShadow: "var(--shadow-soft)" }}>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-semibold text-emerald-700">Points forts</h3>
                </div>
                <ul className="space-y-2">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="text-sm rounded-lg border border-emerald-200/80 bg-emerald-50/80 dark:bg-emerald-950/30 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-200 px-3 py-2">{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <h3 className="font-semibold text-red-700">Points faibles</h3>
                </div>
                <ul className="space-y-2">
                  {result.weaknesses.map((w, i) => (
                    <li key={i} className="text-sm rounded-lg border border-red-200/80 bg-red-50/80 dark:bg-red-950/30 dark:border-red-800/50 text-red-800 dark:text-red-200 px-3 py-2">{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <Card className="lg:col-span-3 p-6 border-border/70" style={{ boxShadow: "var(--shadow-soft)" }}>
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="h-5 w-5 text-brand" />
              <h3 className="text-lg font-semibold">Détail par critère</h3>
            </div>
            <div className="space-y-5">
              {result.criteria.map((c, i) => (
                <div key={i} className="rounded-lg border border-border bg-card/60 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="font-medium text-sm">{c.name}</span>
                    <span className="text-sm tabular-nums text-muted-foreground shrink-0">{c.score} / {c.max}</span>
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
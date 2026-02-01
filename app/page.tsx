"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BrainCircuit,
  CircleDot,
  Globe2,
  Radar,
  Sparkles,
  Timer,
} from "lucide-react";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FloatingParticles } from "@/components/floating-particles";
import { cn } from "@/lib/utils";
import type {
  ClassifiedSnippet,
  EmotionStats,
  NarrativeCluster,
  Snippet,
} from "@/lib/models";
import {
  fadeInUp,
  glowPulse,
  hoverSpring,
  softBlurReveal,
  staggerChildren,
} from "@/lib/motion";

type MinoResponse = {
  items: ClassifiedSnippet[];
  clusters?: NarrativeCluster[];
};

type AnalysisSnapshot = {
  emotionDistribution: Record<string, number>;
  clusters: Record<string, number>;
  timestamp: number;
};

type AnalysisResult = {
  snippets: Snippet[];
  items: ClassifiedSnippet[];
  emotionBars: EmotionStats[];
  concerns: { label: string; count: number }[];
  clusters: NarrativeCluster[];
  volatility: number;
  dominantNarrative?: string;
  dominantConcern?: string;
  risingNarratives: { label: string; delta: number }[];
  timestamp: number;
};

type ErrorState = {
  type: "perplexity" | "mino" | "malformed" | "validation";
  message: string;
  step: "retrieve" | "reason" | "parse";
};

const MotionCard = motion(Card);

const timeWindows = [
  { label: "24h", value: "24h" },
  { label: "72h", value: "72h" },
  { label: "7 days", value: "7 days" },
];

const sourceTabs = [
  { label: "News", value: "news" },
  { label: "Public", value: "public discussions" },
  { label: "Mixed", value: "mixed" },
];

const emotionGradients: Record<string, string> = {
  joy: "from-amber-400/80 to-rose-500/80",
  optimism: "from-teal-400/80 to-sky-500/80",
  trust: "from-emerald-400/80 to-cyan-500/80",
  fear: "from-fuchsia-500/70 to-indigo-500/70",
  anger: "from-rose-500/80 to-orange-500/80",
  sadness: "from-blue-500/80 to-slate-500/80",
  uncertainty: "from-purple-400/80 to-indigo-500/80",
  neutral: "from-slate-400/70 to-slate-600/70",
};

function getEmotionGradient(emotion: string) {
  const key = emotion.toLowerCase();
  return emotionGradients[key] ?? "from-slate-500/70 to-slate-700/70";
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
}

export default function Home() {
  const [topic, setTopic] = useState("");
  const [region, setRegion] = useState("");
  const [timeWindow, setTimeWindow] = useState("72h");
  const [sourceFocus, setSourceFocus] = useState("mixed");
  const [loading, setLoading] = useState(false);
  const [stream, setStream] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [lastSnippets, setLastSnippets] = useState<Snippet[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { scrollYProgress } = useScroll();
  const parallaxY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const parallaxScroll = useTransform(scrollYProgress, [0, 1], [0, -70]);

  const lastSnapshot = useMemo<AnalysisSnapshot | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem("pmr-last-run");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AnalysisSnapshot;
    } catch {
      return null;
    }
  }, [analysis?.timestamp]);

  const persistSnapshot = useCallback((snapshot: AnalysisSnapshot) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("pmr-last-run", JSON.stringify(snapshot));
  }, []);

  const computeAnalysis = useCallback(
    (snippets: Snippet[], mino: MinoResponse): AnalysisResult => {
      const items = mino.items ?? [];
      const emotionCounts = items.reduce<Record<string, number>>(
        (acc, item) => {
          const key = normalizeLabel(item.emotion || "neutral");
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        },
        {}
      );

      const total = Math.max(items.length, 1);
      const emotionBars = Object.entries(emotionCounts)
        .map(([emotion, count]) => ({
          emotion,
          count,
          percentage: Math.round((count / total) * 100),
        }))
        .sort((a, b) => b.count - a.count);

      const concernCounts = items.reduce<Record<string, number>>(
        (acc, item) => {
          const key = normalizeLabel(item.concern || "general sentiment");
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        },
        {}
      );

      const concerns = Object.entries(concernCounts)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);

      const dominantConcern = concerns[0]?.label;

      const computedClusters = items.reduce<Record<string, NarrativeCluster>>(
        (acc, item) => {
          const label =
            item.cluster?.trim() ||
            item.narrative?.trim() ||
            "general narrative";
          if (!acc[label]) {
            acc[label] = { label, size: 0, exampleHeadlines: [] };
          }
          acc[label].size += 1;
          const headline = Number.isFinite(item.index)
            ? snippets[item.index]?.title
            : undefined;
          if (
            headline &&
            acc[label].exampleHeadlines.length < 3 &&
            !acc[label].exampleHeadlines.includes(headline)
          ) {
            acc[label].exampleHeadlines.push(headline);
          }
          return acc;
        },
        {}
      );

      const clusters = (mino.clusters?.length
        ? mino.clusters
        : Object.values(computedClusters)
      ).sort((a, b) => b.size - a.size);

      const currentDist: Record<string, number> = {};
      emotionBars.forEach((bar) => {
        currentDist[bar.emotion] = bar.percentage / 100;
      });

      const previousDist = lastSnapshot?.emotionDistribution ?? {};
      const allEmotions = new Set([
        ...Object.keys(currentDist),
        ...Object.keys(previousDist),
      ]);
      let volatilityScore = 0;
      allEmotions.forEach((emotion) => {
        volatilityScore += Math.abs(
          (currentDist[emotion] ?? 0) - (previousDist[emotion] ?? 0)
        );
      });
      const volatility = Math.round(Math.min(1, volatilityScore / 2) * 100);

      const clusterMap = clusters.reduce<Record<string, number>>(
        (acc, cluster) => {
          acc[cluster.label] = cluster.size;
          return acc;
        },
        {}
      );
      const prevClusterMap = lastSnapshot?.clusters ?? {};
      const risingNarratives = Object.entries(clusterMap)
        .map(([label, size]) => ({
          label,
          delta: size - (prevClusterMap[label] ?? 0),
        }))
        .filter((entry) => entry.delta > 0)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 5);

      persistSnapshot({
        emotionDistribution: currentDist,
        clusters: clusterMap,
        timestamp: Date.now(),
      });

      const dominantNarrative = clusters[0]?.label;

      return {
        snippets,
        items,
        emotionBars,
        concerns,
        clusters,
        volatility,
        dominantNarrative,
        dominantConcern,
        risingNarratives,
        timestamp: Date.now(),
      };
    },
    [lastSnapshot, persistSnapshot]
  );

  const runAnalysis = useCallback(async () => {
    setErrorState(null);
    if (!topic.trim() || !region.trim()) {
      setErrorState({
        type: "validation",
        message: "Please enter a topic and region.",
        step: "retrieve",
      });
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setStream(["Fetching public sources…"]);
    setAnalysis(null);

    try {
      const retrieveResponse = await fetch("/api/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, region, timeWindow, sourceFocus }),
        signal: controller.signal,
      });

      if (!retrieveResponse.ok) {
        const errorPayload = await retrieveResponse.json().catch(() => ({}));
        setErrorState({
          type: errorPayload.errorType ?? "perplexity",
          message:
            errorPayload.error ||
            "Perplexity retrieval failed. Please retry.",
          step: "retrieve",
        });
        return;
      }

      const retrieveData = (await retrieveResponse.json()) as {
        snippets: Snippet[];
      };
      setLastSnippets(retrieveData.snippets ?? []);

      setStream((prev) => [...prev, "Classifying emotions…"]);

      const reasonResponse = await fetch("/api/reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          region,
          timeWindow,
          sourceFocus,
          snippets: retrieveData.snippets,
        }),
        signal: controller.signal,
      });

      if (!reasonResponse.ok) {
        const errorPayload = await reasonResponse.json().catch(() => ({}));
        setErrorState({
          type: errorPayload.errorType ?? "mino",
          message:
            errorPayload.error ||
            "Mino classification failed. Please retry.",
          step: errorPayload.errorType === "malformed" ? "parse" : "reason",
        });
        return;
      }

      const reasonData = (await reasonResponse.json()) as MinoResponse;
      setStream((prev) => [...prev, "Synthesizing dashboard…"]);

      const computed = computeAnalysis(retrieveData.snippets, reasonData);
      setAnalysis(computed);
      setStream((prev) => [...prev, "Analysis complete."]);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setErrorState({
        type: "validation",
        message:
          err instanceof Error ? err.message : "Unexpected analysis error.",
        step: "retrieve",
      });
    } finally {
      setLoading(false);
    }
  }, [topic, region, timeWindow, sourceFocus, computeAnalysis]);

  const retryRetrieve = useCallback(() => {
    if (loading) return;
    runAnalysis();
  }, [loading, runAnalysis]);

  const retryReason = useCallback(async () => {
    if (loading || !lastSnippets.length) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setErrorState(null);
    setLoading(true);
    setStream(["Re-running classification…"]);
    try {
      const reasonResponse = await fetch("/api/reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          region,
          timeWindow,
          sourceFocus,
          snippets: lastSnippets,
        }),
        signal: controller.signal,
      });

      if (!reasonResponse.ok) {
        const errorPayload = await reasonResponse.json().catch(() => ({}));
        setErrorState({
          type: errorPayload.errorType ?? "mino",
          message:
            errorPayload.error ||
            "Mino classification failed. Please retry.",
          step: errorPayload.errorType === "malformed" ? "parse" : "reason",
        });
        return;
      }

      const reasonData = (await reasonResponse.json()) as MinoResponse;
      const computed = computeAnalysis(lastSnippets, reasonData);
      setAnalysis(computed);
      setStream((prev) => [...prev, "Analysis complete."]);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setErrorState({
        type: "validation",
        message:
          err instanceof Error ? err.message : "Unexpected analysis error.",
        step: "reason",
      });
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    lastSnippets,
    topic,
    region,
    timeWindow,
    sourceFocus,
    computeAnalysis,
  ]);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setStream((prev) =>
        prev.includes("Detecting narratives…")
          ? prev
          : [...prev, "Detecting narratives…"]
      );
    }, 1200);
    return () => clearTimeout(timer);
  }, [loading]);

  const hasData = Boolean(analysis?.snippets.length);
  const heroCollapsed = loading || hasData;

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-background text-foreground">
        <motion.section
          className={cn(
            "px-6 pb-16 pt-10 md:px-12",
            heroCollapsed && "sticky top-4 z-40 pb-6"
          )}
          layout
        >
          <motion.div
            className={cn(
              "hero-shell mx-auto max-w-6xl px-8 py-14 md:px-12",
              heroCollapsed && "py-6"
            )}
            initial="hidden"
            animate="visible"
            variants={staggerChildren}
            layout
          >
            <motion.div
              className="absolute inset-0 opacity-70"
              style={{ y: parallaxY }}
              aria-hidden
            >
              <div className="absolute inset-0 bg-hero opacity-90" />
            </motion.div>
            {!heroCollapsed ? <FloatingParticles className="opacity-60" /> : null}
            <div className="noise-overlay" />
            <motion.div
              className="relative z-10 flex flex-col gap-6"
              variants={softBlurReveal}
            >
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="bg-white/10 text-white">
                  <Radar className="h-3.5 w-3.5" />
                  Public Mood Radar Pro
                </Badge>
                <Badge variant="outline" className="border-white/20 text-white/80">
                  Live intelligence
                </Badge>
              </div>
              <motion.h1
                className={cn(
                  "font-display text-3xl font-semibold leading-tight text-white md:text-5xl",
                  heroCollapsed && "text-2xl md:text-3xl"
                )}
                variants={softBlurReveal}
              >
                Understand what the public is really feeling — in real time.
              </motion.h1>
              {!heroCollapsed ? (
                <motion.p
                  className="max-w-2xl text-base text-white/80 md:text-lg"
                  variants={fadeInUp}
                >
                  Track emotions, concerns and narratives around any topic,
                  powered by live public data.
                </motion.p>
              ) : null}
            </motion.div>
          </motion.div>
        </motion.section>

        <section className="px-6 pb-10 md:px-12">
          <motion.div
            className="mx-auto max-w-6xl"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerChildren}
          >
            <Card className="glass-panel">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-sky-300" />
                    Analysis Controls
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    One click runs retrieval and reasoning on live sources.
                  </p>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      Methodology
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>How the radar works</DialogTitle>
                      <DialogDescription>
                        Perplexity retrieves live public sources. Mino classifies
                        emotions, concerns, and narratives. All scoring, cluster
                        sizing, and volatility computations are calculated
                        locally.
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-[1.2fr_1fr_1fr_1fr] md:items-end">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-white/60">
                    Topic
                  </label>
                  <Input
                    placeholder="e.g. AI regulation, lithium supply"
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-white/60">
                    Region
                  </label>
                  <Input
                    placeholder="Country or city"
                    value={region}
                    onChange={(event) => setRegion(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-white/60">
                    Time window
                  </label>
                  <Select value={timeWindow} onValueChange={setTimeWindow}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select window" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeWindows.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <label className="text-xs uppercase tracking-wider text-white/60">
                    Source focus
                  </label>
                  <Tabs value={sourceFocus} onValueChange={setSourceFocus}>
                    <TabsList className="grid w-full grid-cols-3">
                      {sourceTabs.map((tab) => (
                        <TabsTrigger key={tab.value} value={tab.value}>
                          {tab.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              </CardContent>
              <CardContent className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div className="flex items-center gap-3">
                  <Button
                    size="lg"
                    onClick={runAnalysis}
                    disabled={loading}
                    className={cn(loading && "shimmer")}
                  >
                    <Activity className="h-5 w-5" />
                    Analyze Public Mood
                  </Button>
                  {loading ? (
                    <Badge className="animate-pulse bg-white/10 text-white/80">
                      Live run
                    </Badge>
                  ) : null}
                </div>
                {errorState ? (
                  <span className="text-sm text-rose-300">
                    {errorState.message}
                  </span>
                ) : null}
              </CardContent>
            </Card>
          </motion.div>
        </section>

        <motion.section
          className="px-6 pb-20 md:px-12"
          initial="hidden"
          animate={loading || hasData ? "visible" : "hidden"}
          variants={staggerChildren}
        >
          <motion.div
            className="mx-auto max-w-6xl"
            style={{ y: parallaxScroll }}
            variants={softBlurReveal}
          >
            <div className="dashboard-shell p-6 md:p-8">
              <div className="dashboard-gradient" aria-hidden />
              <div className="dashboard-noise" aria-hidden />
              <div className="relative z-10 space-y-8">
                <motion.div
                  className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                  variants={fadeInUp}
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                      Live Public Pulse Room
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
                      Live Public Pulse Room
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge className="bg-white/10 text-white/80">
                      Live data via Perplexity · Analysis via Mino
                    </Badge>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          View data sources
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Data provenance</DialogTitle>
                          <DialogDescription>
                            Sources used in the current run, with timestamps and
                            links.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4 space-y-3 text-sm">
                          {analysis ? (
                            analysis.snippets.map((snippet) => (
                              <div
                                key={snippet.url}
                                className="rounded-xl border border-white/10 bg-white/5 p-3"
                              >
                                <a
                                  href={snippet.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-semibold text-white hover:text-sky-200"
                                >
                                  {snippet.title}
                                </a>
                                <p className="mt-1 text-xs text-white/50">
                                  {snippet.publishedAt}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Run an analysis to view sources.
                            </p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </motion.div>

                <motion.div
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6"
                  variants={glowPulse}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                        Today’s Public Focus
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {analysis?.dominantNarrative ?? "Awaiting live signal"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white">
                      {analysis?.dominantConcern ?? "Dominant concern pending"}
                    </div>
                  </div>
                </motion.div>

                {errorState ? (
                  <motion.div variants={fadeInUp}>
                    <MotionCard className="glass-panel border-rose-400/40" {...hoverSpring}>
                      <CardHeader>
                        <CardTitle className="text-rose-200">
                          {errorState.type === "perplexity"
                            ? "Perplexity retrieval failed"
                            : errorState.type === "mino"
                            ? "Mino classification failed"
                            : errorState.type === "malformed"
                            ? "Malformed AI output"
                            : "Analysis error"}
                        </CardTitle>
                        <p className="text-sm text-rose-200/80">
                          {errorState.message}
                        </p>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-3">
                        <Button
                          variant="outline"
                          onClick={retryRetrieve}
                          disabled={loading}
                        >
                          Retry retrieval
                        </Button>
                        <Button
                          onClick={retryReason}
                          disabled={loading || !lastSnippets.length}
                        >
                          Retry classification
                        </Button>
                      </CardContent>
                    </MotionCard>
                  </motion.div>
                ) : null}

                <div className="grid gap-6 lg:grid-cols-3">
                  <motion.div
                    className="lg:col-span-2"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    variants={staggerChildren}
                  >
                    <motion.div variants={fadeInUp}>
                      <MotionCard className="glass-panel" {...hoverSpring}>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <BrainCircuit className="h-5 w-5 text-sky-300" />
                              Collective Emotional State
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              Live distribution across detected emotions.
                            </p>
                          </div>
                          <motion.div variants={glowPulse} className="text-right">
                            <p className="text-xs text-muted-foreground">
                              Public Mood Instability
                            </p>
                            <p className="text-lg font-semibold text-white">
                              {analysis ? `${analysis.volatility}%` : "--"}
                            </p>
                          </motion.div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {analysis ? (
                            analysis.emotionBars.map((bar) => (
                              <motion.div
                                key={bar.emotion}
                                className="space-y-2"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4 }}
                              >
                                <div className="flex items-center justify-between text-sm">
                                  <span className="capitalize">{bar.emotion}</span>
                                  <span className="text-white/70">
                                    {bar.percentage}%
                                  </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-white/10">
                                  <motion.div
                                    className={cn(
                                      "h-full rounded-full bg-gradient-to-r",
                                      getEmotionGradient(bar.emotion)
                                    )}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${bar.percentage}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                  />
                                </div>
                              </motion.div>
                            ))
                          ) : (
                            <div className="space-y-3">
                              {[1, 2, 3].map((item) => (
                                <div
                                  key={item}
                                  className="h-6 w-full rounded-full bg-white/5 shimmer"
                                />
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </MotionCard>
                    </motion.div>
                  </motion.div>

                  <motion.div
                    className="space-y-6"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    variants={staggerChildren}
                  >
                    <motion.div variants={fadeInUp}>
                      <MotionCard className="glass-panel" {...hoverSpring}>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Globe2 className="h-5 w-5 text-emerald-300" />
                            Public Concerns
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Ranked concerns surfaced in live sources.
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {analysis ? (
                            analysis.concerns.slice(0, 6).map((concern, index) => (
                              <div
                                key={concern.label}
                                className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"
                              >
                                <span className="text-sm">
                                  {index + 1}. {concern.label}
                                </span>
                                <Badge className="bg-white/10 text-white/80">
                                  {concern.count}
                                </Badge>
                              </div>
                            ))
                          ) : (
                            <div className="space-y-2">
                              {[1, 2, 3].map((item) => (
                                <div
                                  key={item}
                                  className="h-10 rounded-xl bg-white/5 shimmer"
                                />
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </MotionCard>
                    </motion.div>

                    <motion.div variants={fadeInUp}>
                      <MotionCard className="glass-panel" {...hoverSpring}>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Timer className="h-5 w-5 text-sky-300" />
                              Public Mood Instability
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              Change vs last run.
                            </p>
                          </div>
                          <Badge className="bg-white/10 text-white/80">
                            {analysis ? `${analysis.volatility}%` : "--"}
                          </Badge>
                        </CardHeader>
                        <CardContent>
                          <div className="relative mx-auto h-40 w-40">
                            <div className="absolute inset-0 rounded-full border border-white/10" />
                            <div className="absolute inset-3 rounded-full border border-white/10" />
                            <motion.div
                              className="absolute left-1/2 top-1/2 h-16 w-1 origin-bottom rounded-full bg-gradient-to-b from-sky-400 to-violet-400"
                              style={{
                                rotate: analysis
                                  ? `${-90 + (analysis.volatility / 100) * 180}deg`
                                  : "-90deg",
                              }}
                              animate={{ opacity: 1 }}
                              transition={{ type: "spring", stiffness: 120 }}
                            />
                            <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-glow" />
                          </div>
                          <p className="mt-4 text-center text-sm text-muted-foreground">
                            {analysis?.volatility
                              ? "Higher score indicates rapid sentiment shift."
                              : "Run analysis to measure volatility."}
                          </p>
                        </CardContent>
                      </MotionCard>
                    </motion.div>
                  </motion.div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                  <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    variants={staggerChildren}
                  >
                    <motion.div variants={fadeInUp}>
                      <MotionCard className="glass-panel" {...hoverSpring}>
                        <CardHeader className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <CircleDot className="h-5 w-5 text-violet-300" />
                              Dominant Public Narratives
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              Grouped storylines and emerging frames.
                            </p>
                          </div>
                          <Badge variant="outline" className="border-white/20">
                            {analysis ? `${analysis.clusters.length} clusters` : "--"}
                          </Badge>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                          {analysis ? (
                            analysis.clusters.map((cluster) => (
                              <motion.div
                                key={cluster.label}
                                className="rounded-2xl border border-white/10 bg-white/5 p-4"
                                {...hoverSpring}
                              >
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-semibold text-white">
                                    {cluster.label}
                                  </p>
                                  <Badge className="bg-white/10 text-white">
                                    {cluster.size}
                                  </Badge>
                                </div>
                                <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                                  {cluster.exampleHeadlines
                                    .slice(0, 3)
                                    .map((headline) => (
                                      <li key={headline} className="flex gap-2">
                                        <span className="text-white/60">•</span>
                                        <span>{headline}</span>
                                      </li>
                                    ))}
                                </ul>
                              </motion.div>
                            ))
                          ) : (
                            <div className="col-span-full grid gap-3 md:grid-cols-2">
                              {[1, 2, 3, 4].map((item) => (
                                <div
                                  key={item}
                                  className="h-24 rounded-2xl bg-white/5 shimmer"
                                />
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </MotionCard>
                    </motion.div>
                  </motion.div>

                  <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    variants={staggerChildren}
                  >
                    <motion.div variants={fadeInUp}>
                      <MotionCard className="glass-panel" {...hoverSpring}>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-amber-300" />
                            Rising Narratives
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Clusters growing since last run.
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {analysis ? (
                            analysis.risingNarratives.length ? (
                              analysis.risingNarratives.map((narrative) => (
                                <div
                                  key={narrative.label}
                                  className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"
                                >
                                  <span className="text-sm">
                                    {narrative.label}
                                  </span>
                                  <span className="text-xs text-emerald-300">
                                    +{narrative.delta}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                No rising narratives detected yet.
                              </p>
                            )
                          ) : (
                            <div className="h-12 rounded-xl bg-white/5 shimmer" />
                          )}
                        </CardContent>
                      </MotionCard>
                    </motion.div>
                  </motion.div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
                  <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    variants={staggerChildren}
                  >
                    <motion.div variants={fadeInUp}>
                      <MotionCard className="glass-panel" {...hoverSpring}>
                        <CardHeader className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <ArrowUpRight className="h-5 w-5 text-emerald-300" />
                              Evidence Panel
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              Sources used in the current analysis.
                            </p>
                          </div>
                          {analysis ? (
                            <Badge className="bg-white/10 text-white/80">
                              {analysis.snippets.length} sources
                            </Badge>
                          ) : null}
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {analysis ? (
                            analysis.snippets.slice(0, 8).map((snippet) => (
                              <div
                                key={snippet.url}
                                className="rounded-2xl border border-white/10 bg-white/5 p-4"
                              >
                                <a
                                  href={snippet.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm font-semibold text-white hover:text-sky-200"
                                >
                                  {snippet.title}
                                </a>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {snippet.snippet}
                                </p>
                                <p className="mt-2 text-[11px] text-white/50">
                                  {snippet.publishedAt}
                                </p>
                              </div>
                            ))
                          ) : (
                            <div className="space-y-3">
                              {[1, 2, 3].map((item) => (
                                <div
                                  key={item}
                                  className="h-20 rounded-2xl bg-white/5 shimmer"
                                />
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </MotionCard>
                    </motion.div>
                  </motion.div>

                  <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    variants={staggerChildren}
                  >
                    <motion.div variants={fadeInUp}>
                      <MotionCard className="glass-panel" {...hoverSpring}>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-sky-300" />
                            Pulse Activity Feed
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Transparent step-by-step updates.
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <AnimatePresence>
                            {stream.length ? (
                              stream.map((entry, index) => (
                                <motion.div
                                  key={`${entry}-${index}`}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.4 }}
                                  className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm"
                                >
                                  <span>{entry}</span>
                                  <span className="text-xs text-white/50">
                                    {loading && index === stream.length - 1
                                      ? "in progress"
                                      : "done"}
                                  </span>
                                </motion.div>
                              ))
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                Start an analysis to see the live stream.
                              </p>
                            )}
                          </AnimatePresence>
                        </CardContent>
                      </MotionCard>
                    </motion.div>

                    <motion.div variants={fadeInUp}>
                      <MotionCard className="glass-panel" {...hoverSpring}>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-purple-300" />
                            Dominant Public Concern
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="ml-1 cursor-help text-xs text-white/50">
                                  ⓘ
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Derived from top-ranked concern labels.
                              </TooltipContent>
                            </Tooltip>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                            <p className="text-sm text-muted-foreground">
                              Current dominant concern
                            </p>
                            <motion.p
                              className="mt-3 text-2xl font-semibold text-white"
                              variants={glowPulse}
                              initial="hidden"
                              animate="visible"
                            >
                              {analysis?.dominantConcern ?? "—"}
                            </motion.p>
                            <p className="mt-2 text-xs text-white/50">
                              {hasData
                                ? `Based on ${analysis?.items.length} classified snippets.`
                                : "Awaiting live input."}
                            </p>
                          </div>
                        </CardContent>
                      </MotionCard>
                    </motion.div>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.section>

        <footer className="px-6 pb-10 text-center text-xs text-white/40">
          <p>
            Public Mood Radar Pro — evidence-forward intelligence. No hidden
            background jobs.
          </p>
        </footer>
      </main>
    </TooltipProvider>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Globe2,
  Lightbulb,
  LineChart,
  Sparkles,
  Star,
  Wand2,
} from "lucide-react";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FloatingParticles } from "@/components/floating-particles";
import { cn } from "@/lib/utils";
import { fadeInUp, glowPulse, hoverSpring, softBlurReveal, staggerChildren } from "@/lib/motion";

type StageKey = "A" | "B" | "C" | "D" | "E";

type StageStatus = "idle" | "running" | "complete" | "error";

type StageEvent = {
  stage: StageKey;
  status: "start" | "progress" | "complete" | "error";
  message?: string;
  data?: unknown;
};

type Signal = {
  title: string;
  snippet: string;
  url: string;
  publishedAt: string;
};

type Opportunity = {
  title: string;
  description: string;
  platformFit: string;
  audienceAngle: string;
  evidenceIndexes: number[];
  newness: string;
};

type OpportunityGap = {
  gap: string;
  whyNow: string;
  suggestedContent: string;
};

type OpportunityScore = {
  title: string;
  score: number;
  risk: string;
  effort: string;
  rationale: string;
  recommended: boolean;
};

type Playbook = {
  positioning: string;
  contentPillars: string[];
  weeklyPlan: string[];
  monetizationIdeas: string[];
  collaborationTargets: string[];
  watchouts: string[];
};

type PipelineResults = {
  signals: Signal[];
  normalized: Signal[];
  opportunities: Opportunity[];
  gaps: OpportunityGap[];
  scored: OpportunityScore[];
  playbook?: Playbook;
};

type StageState = {
  key: StageKey;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: StageStatus;
};

const MotionCard = motion(Card);

const stagesMeta: Omit<StageState, "status">[] = [
  {
    key: "A",
    title: "Perplexity Signals",
    description: "Live trends and public signals",
    icon: <Globe2 className="h-5 w-5" />,
  },
  {
    key: "B",
    title: "Normalization",
    description: "Clean and structured signals",
    icon: <LineChart className="h-5 w-5" />,
  },
  {
    key: "C",
    title: "Opportunity Mining",
    description: "Gaps and angles extracted",
    icon: <Lightbulb className="h-5 w-5" />,
  },
  {
    key: "D",
    title: "Scoring & Risk",
    description: "Impact and feasibility ranking",
    icon: <Star className="h-5 w-5" />,
  },
  {
    key: "E",
    title: "Creator Playbook",
    description: "Action plan and monetization",
    icon: <Wand2 className="h-5 w-5" />,
  },
];

function useScrollReveal() {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.2 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

export default function Home() {
  const [niche, setNiche] = useState("");
  const [platform, setPlatform] = useState("");
  const [audience, setAudience] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PipelineResults>({
    signals: [],
    normalized: [],
    opportunities: [],
    gaps: [],
    scored: [],
    playbook: undefined,
  });
  const [stages, setStages] = useState<StageState[]>(
    stagesMeta.map((stage) => ({ ...stage, status: "idle" }))
  );
  const abortRef = useRef<AbortController | null>(null);

  const { scrollYProgress } = useScroll();
  const heroParallax = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const backgroundParallax = useTransform(scrollYProgress, [0, 1], [0, -40]);

  const completedCount = useMemo(
    () => stages.filter((stage) => stage.status === "complete").length,
    [stages]
  );
  const progressPercent = Math.round((completedCount / stages.length) * 100);
  const evidenceSignals = results.normalized.length
    ? results.normalized
    : results.signals;
  const opportunityEvidence = useMemo(() => {
    const byTitle = new Map<string, Signal[]>();
    results.opportunities.forEach((opportunity) => {
      const unique = new Map<string, Signal>();
      opportunity.evidenceIndexes.forEach((index) => {
        const signal = evidenceSignals[index];
        if (signal?.url) unique.set(signal.url, signal);
      });
      byTitle.set(opportunity.title, Array.from(unique.values()));
    });
    return byTitle;
  }, [evidenceSignals, results.opportunities]);

  const setStageStatus = useCallback((stageKey: StageKey, status: StageStatus) => {
    setStages((prev) =>
      prev.map((stage) =>
        stage.key === stageKey ? { ...stage, status } : stage
      )
    );
  }, []);

  const appendLog = useCallback((message: string) => {
    setLogs((prev) => [...prev, message]);
  }, []);

  const resetPipeline = useCallback(() => {
    setLogs([]);
    setError(null);
    setResults({
      signals: [],
      normalized: [],
      opportunities: [],
      gaps: [],
      scored: [],
      playbook: undefined,
    });
    setStages(stagesMeta.map((stage) => ({ ...stage, status: "idle" })));
  }, []);

  const handleEvent = useCallback((event: StageEvent) => {
    if (event.status === "start") {
      setStageStatus(event.stage, "running");
      if (event.message) appendLog(event.message);
      return;
    }
    if (event.status === "progress") {
      if (event.message) appendLog(event.message);
      return;
    }
    if (event.status === "complete") {
      setStageStatus(event.stage, "complete");
      if (event.message) appendLog(event.message);
      if (event.stage === "A" && event.data && typeof event.data === "object") {
        const data = event.data as { signals?: Signal[] };
        setResults((prev) => ({ ...prev, signals: data.signals ?? [] }));
      }
      if (event.stage === "B" && event.data && typeof event.data === "object") {
        const data = event.data as { normalized?: Signal[] };
        setResults((prev) => ({ ...prev, normalized: data.normalized ?? [] }));
      }
      if (event.stage === "C" && event.data && typeof event.data === "object") {
        const data = event.data as {
          opportunities?: Opportunity[];
          gaps?: OpportunityGap[];
        };
        setResults((prev) => ({
          ...prev,
          opportunities: data.opportunities ?? [],
          gaps: data.gaps ?? [],
        }));
      }
      if (event.stage === "D" && event.data && typeof event.data === "object") {
        const data = event.data as { scored?: OpportunityScore[] };
        setResults((prev) => ({ ...prev, scored: data.scored ?? [] }));
      }
      if (event.stage === "E" && event.data && typeof event.data === "object") {
        const data = event.data as { playbook?: Playbook };
        setResults((prev) => ({ ...prev, playbook: data.playbook }));
      }
      return;
    }
    if (event.status === "error") {
      setStageStatus(event.stage, "error");
      setError(event.message ?? "Pipeline error");
      if (event.message) appendLog(event.message);
    }
  }, [appendLog, setStageStatus]);

  const runPipeline = useCallback(async () => {
    resetPipeline();
    if (!niche.trim() || !platform.trim() || !audience.trim()) {
      setError("Please enter niche, platform, and target audience.");
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    appendLog("Initializing Creator Opportunity Radar…");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche,
          platform,
          audience,
          country: country || undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        setError("Streaming pipeline unavailable.");
        setLoading(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line) as StageEvent;
            handleEvent(parsed);
          } catch {
            continue;
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Streaming error");
    } finally {
      setLoading(false);
    }
  }, [appendLog, audience, country, handleEvent, niche, platform, resetPipeline]);

  const stageReveal = useScrollReveal();
  const resultReveal = useScrollReveal();

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <motion.section
        className="relative overflow-hidden px-6 pb-12 pt-20 md:px-12 md:pt-24"
        initial="hidden"
        animate="visible"
        variants={staggerChildren}
      >
        <motion.div
          className="absolute inset-0 -z-10 opacity-80"
          style={{ y: backgroundParallax }}
        >
          <div className="absolute -left-32 top-10 h-64 w-64 rounded-full bg-sky-400/30 blur-3xl" />
          <div className="absolute right-0 top-32 h-72 w-72 rounded-full bg-violet-400/30 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl" />
        </motion.div>

        <div className="mx-auto max-w-6xl">
          <motion.div
            className="hero-shell relative overflow-hidden px-8 py-14 md:px-12"
            variants={softBlurReveal}
          >
            <motion.div className="absolute inset-0 opacity-70" style={{ y: heroParallax }}>
              <div className="absolute inset-0 bg-hero opacity-90" />
            </motion.div>
            <FloatingParticles className="opacity-70" />
            <div className="noise-overlay" />
            <div className="relative z-10 space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="bg-white/15 text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                  Creator Opportunity Radar
                </Badge>
                <Badge variant="outline" className="border-white/30 text-white/80">
                  Live creator intelligence
                </Badge>
              </div>
              <motion.h1
                className="font-display text-4xl font-semibold leading-tight text-white md:text-6xl"
                variants={softBlurReveal}
              >
                Discover content wins and monetization angles before they trend.
              </motion.h1>
              <motion.p
                className="max-w-2xl text-base text-white/80 md:text-lg"
                variants={fadeInUp}
              >
                Creator Opportunity Radar turns live signals into a structured playbook for
                any niche, platform, and audience.
              </motion.p>
            </div>
          </motion.div>
        </div>
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
                  <Bot className="h-5 w-5 text-sky-300" />
                  Creator Input
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Map your niche, platform, and audience to a playbook in minutes.
                </p>
              </div>
              <Badge className="bg-white/10 text-white/80">
                Streaming pipeline A → E
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-white/60">
                  Niche
                </label>
                <Input
                  placeholder="e.g. AI productivity"
                  value={niche}
                  onChange={(event) => setNiche(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-white/60">
                  Platform
                </label>
                <Input
                  placeholder="YouTube, TikTok, Substack"
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-white/60">
                  Target audience
                </label>
                <Input
                  placeholder="Founders, students, creators"
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-white/60">
                  Country (optional)
                </label>
                <Input
                  placeholder="USA, India"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                />
              </div>
            </CardContent>
            <CardContent className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <motion.div whileTap={{ scale: 0.96 }}>
                <Button
                  size="lg"
                  onClick={runPipeline}
                  disabled={loading}
                  className={cn(loading && "shimmer")}
                >
                  <Activity className="h-5 w-5" />
                  Generate Opportunity Radar
                </Button>
              </motion.div>
              {error ? <span className="text-sm text-rose-300">{error}</span> : null}
            </CardContent>
          </Card>
        </motion.div>
      </section>

      <section ref={stageReveal.ref} className="px-6 pb-10 md:px-12">
        <motion.div
          className="mx-auto max-w-6xl space-y-6"
          initial="hidden"
          animate={stageReveal.isVisible ? "visible" : "hidden"}
          variants={staggerChildren}
        >
          <motion.div variants={fadeInUp} className="glass-panel rounded-2xl p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Streaming Timeline
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Creator Opportunity Pipeline
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-white/10 text-white/80">
                  {progressPercent}% complete
                </Badge>
                <motion.div
                  className="h-2 w-40 overflow-hidden rounded-full bg-white/10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div
                    className="h-full bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400"
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.6 }}
                  />
                </motion.div>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-5">
              {stages.map((stage) => (
                <motion.div
                  key={stage.key}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  {...hoverSpring}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <div className="rounded-full bg-white/10 p-2 text-white">
                        {stage.icon}
                      </div>
                      <span className="text-white">{stage.title}</span>
                    </div>
                    {stage.status === "complete" ? (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-emerald-300"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </motion.span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-xs text-white/60">{stage.description}</p>
                  {stage.status === "running" ? (
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="h-full w-1/2 bg-sky-400"
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{ repeat: Infinity, duration: 1.2 }}
                      />
                    </div>
                  ) : null}
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={fadeInUp} className="glass-panel rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-sky-300" />
              <h3 className="text-lg font-semibold text-white">Streaming Log</h3>
            </div>
            <div className="mt-4 space-y-3">
              <AnimatePresence>
                {logs.length ? (
                  logs.map((entry, index) => (
                    <motion.div
                      key={`${entry}-${index}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                    >
                      {entry}
                    </motion.div>
                  ))
                ) : (
                  <p className="text-sm text-white/60">Logs will appear as stages run.</p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      </section>

      <section ref={resultReveal.ref} className="px-6 pb-16 md:px-12">
        <motion.div
          className="mx-auto max-w-6xl space-y-6"
          initial="hidden"
          animate={resultReveal.isVisible ? "visible" : "hidden"}
          variants={staggerChildren}
        >
          <motion.div variants={fadeInUp}>
            <MotionCard className="glass-panel" {...hoverSpring}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-300" />
                  Opportunities & Content Gaps
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Fresh angles and unmet demand surfaced from live signals.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {loading && !results.opportunities.length ? (
                  <div className="col-span-full grid gap-3 md:grid-cols-2">
                    {[1, 2, 3, 4].map((item) => (
                      <div key={item} className="h-24 rounded-2xl bg-white/5 shimmer" />
                    ))}
                  </div>
                ) : null}
                {results.opportunities.map((opportunity) => (
                  <motion.div
                    key={opportunity.title}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    whileHover={{ y: -6, rotateX: 2, rotateY: -2 }}
                  >
                    {(() => {
                      const sources = opportunityEvidence.get(opportunity.title) ?? [];
                      return (
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">
                        {opportunity.title}
                      </p>
                      <Badge className="bg-white/10 text-white/80">
                        {opportunity.newness}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-white/70">
                      {opportunity.description}
                    </p>
                    <div className="mt-3 text-xs text-white/50">
                      {opportunity.platformFit} · {opportunity.audienceAngle}
                    </div>
                    {sources.length ? (
                      <div className="mt-3 space-y-1 text-xs text-white/60">
                        <p className="text-[10px] uppercase tracking-wider text-white/40">
                          Source signals
                        </p>
                        {sources.slice(0, 2).map((source) => (
                          <a
                            key={source.url}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate hover:text-white"
                          >
                            {source.title}
                          </a>
                        ))}
                        {sources.length > 2 ? (
                          <p className="text-[10px] text-white/40">
                            +{sources.length - 2} more sources
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                      );
                    })()}
                  </motion.div>
                ))}
                {results.gaps.map((gap) => (
                  <motion.div
                    key={gap.gap}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    whileHover={{ y: -6, rotateX: 2, rotateY: -2 }}
                  >
                    <p className="text-sm font-semibold text-white">{gap.gap}</p>
                    <p className="mt-2 text-xs text-white/70">{gap.whyNow}</p>
                    <p className="mt-3 text-xs text-white/50">
                      Suggested: {gap.suggestedContent}
                    </p>
                  </motion.div>
                ))}
              </CardContent>
            </MotionCard>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <MotionCard className="glass-panel" {...hoverSpring}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-sky-300" />
                  Scored Opportunities
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Impact and risk scoring for the highest potential angles.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {loading && !results.scored.length ? (
                  <div className="col-span-full grid gap-3 md:grid-cols-2">
                    {[1, 2, 3, 4].map((item) => (
                      <div key={item} className="h-24 rounded-2xl bg-white/5 shimmer" />
                    ))}
                  </div>
                ) : null}
                {results.scored.map((score) => (
                  <motion.div
                    key={score.title}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    whileHover={{ y: -6, rotateX: 2, rotateY: -2 }}
                  >
                    {(() => {
                      const sources = opportunityEvidence.get(score.title) ?? [];
                      return (
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">{score.title}</p>
                      <Badge
                        className={cn(
                          "bg-white/10 text-white/80",
                          score.score >= 80 && "animate-pulse"
                        )}
                      >
                        {score.score} / 100
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-white/70">{score.rationale}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/50">
                      <span>Risk: {score.risk}</span>
                      <span>Effort: {score.effort}</span>
                      {score.recommended ? (
                        <Badge className="bg-emerald-400/20 text-emerald-200">
                          High potential
                        </Badge>
                      ) : null}
                    </div>
                    {sources.length ? (
                      <div className="mt-3 space-y-1 text-xs text-white/60">
                        <p className="text-[10px] uppercase tracking-wider text-white/40">
                          Source signals
                        </p>
                        {sources.slice(0, 2).map((source) => (
                          <a
                            key={source.url}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate hover:text-white"
                          >
                            {source.title}
                          </a>
                        ))}
                        {sources.length > 2 ? (
                          <p className="text-[10px] text-white/40">
                            +{sources.length - 2} more sources
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                      );
                    })()}
                  </motion.div>
                ))}
              </CardContent>
            </MotionCard>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <MotionCard className="glass-panel" {...hoverSpring}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpRight className="h-5 w-5 text-emerald-300" />
                  Creator Playbook
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Clear next steps for content and monetization.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {loading && !results.playbook ? (
                  <div className="col-span-full grid gap-3 md:grid-cols-2">
                    {[1, 2, 3, 4].map((item) => (
                      <div key={item} className="h-24 rounded-2xl bg-white/5 shimmer" />
                    ))}
                  </div>
                ) : null}
                {results.playbook ? (
                  <>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold text-white">Positioning</p>
                      <p className="mt-2 text-xs text-white/70">
                        {results.playbook.positioning}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold text-white">Content Pillars</p>
                      <ul className="mt-2 space-y-1 text-xs text-white/70">
                        {results.playbook.contentPillars.map((pillar) => (
                          <li key={pillar}>• {pillar}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold text-white">Weekly Plan</p>
                      <ul className="mt-2 space-y-1 text-xs text-white/70">
                        {results.playbook.weeklyPlan.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold text-white">Monetization</p>
                      <ul className="mt-2 space-y-1 text-xs text-white/70">
                        {results.playbook.monetizationIdeas.map((idea) => (
                          <li key={idea}>• {idea}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold text-white">Collaboration</p>
                      <ul className="mt-2 space-y-1 text-xs text-white/70">
                        {results.playbook.collaborationTargets.map((target) => (
                          <li key={target}>• {target}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold text-white">Watchouts</p>
                      <ul className="mt-2 space-y-1 text-xs text-white/70">
                        {results.playbook.watchouts.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </MotionCard>
          </motion.div>
        </motion.div>
      </section>
    </main>
  );
}

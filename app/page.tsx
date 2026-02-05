"use client";

import { useMemo, useState } from "react";
import type { Snippet, Suggestion } from "@/lib/models";
import {
  clamp,
  confidenceLabel,
  daysSince,
  getHostname,
  scoreConfidence,
  scoreDiversity,
  scoreRecency,
  scoreRelevance,
  weightedScore,
} from "@/lib/utils";

const regionOptions = [
  "Global",
  "North America",
  "Europe",
  "India",
  "Southeast Asia",
  "LatAm",
];

const timeWindowOptions = ["24 hours", "72 hours", "7 days", "14 days", "30 days"];

const sourceOptions = [
  "News and analysis",
  "Blogs and newsletters",
  "Forums and community posts",
  "Mixed coverage",
];

const starterTopic = "sustainable fashion";

function buildSuggestions(snippets: Snippet[], topic: string): Suggestion[] {
  const sources = snippets.map((snippet) => ({
    title: snippet.title,
    snippet: snippet.snippet,
    url: snippet.url,
    domain: getHostname(snippet.url),
    publishedAt: snippet.publishedAt,
  }));
  const uniqueDomains = new Set(sources.map((source) => source.domain));
  const diversityScore = scoreDiversity(uniqueDomains.size);

  return snippets.slice(0, 4).map((snippet, index) => {
    const source = sources[index];
    const relevance = scoreRelevance(topic, `${snippet.title} ${snippet.snippet}`);
    const recency = scoreRecency(daysSince(snippet.publishedAt));
    const confidence = scoreConfidence({
      sourceCount: snippets.length,
      diversityScore,
      recencyScore: recency,
    });
    const confidenceText = confidenceLabel(confidence);
    const score = clamp(
      weightedScore([
        { value: relevance, weight: 0.45 },
        { value: recency, weight: 0.35 },
        { value: diversityScore, weight: 0.2 },
      ])
    );

    const title = `Creator angle: ${snippet.title}`;
    const summary = `Frame ${topic} through this signal and extract a hook, a quick POV, and a practical takeaway your audience can act on.`;

    return {
      id: `${source.domain}-${index}`,
      title,
      summary,
      score,
      confidence,
      confidenceLabel: confidenceText,
      signals: {
        relevance,
        recency,
        diversity: diversityScore,
        rationale: [
          `Relevance comes from keyword overlap with "${topic}".`,
          `Recency uses the source date to keep ideas fresh.`,
          `Diversity rewards coverage across distinct domains.`,
        ],
      },
      provenance: {
        sources: [source],
        notes: [
          "Sources are public web articles, blogs, or forums with URLs.",
          "X/Twitter and Reddit are intentionally excluded.",
          "Scores and confidence are directional, not absolute truth.",
        ],
      },
    };
  });
}

export default function HomePage() {
  const [topic, setTopic] = useState(starterTopic);
  const [region, setRegion] = useState(regionOptions[0]);
  const [timeWindow, setTimeWindow] = useState(timeWindowOptions[2]);
  const [sourceFocus, setSourceFocus] = useState(sourceOptions[3]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = useMemo(
    () => buildSuggestions(snippets, topic),
    [snippets, topic]
  );

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, region, timeWindow, sourceFocus }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to load sources.");
      }
      setSnippets(payload.snippets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="px-6 pb-20 pt-12 sm:px-10 lg:px-16">
      <section className="mx-auto max-w-6xl">
        <div className="hero-shell p-8 sm:p-12">
          <div className="noise-overlay" />
          <div className="relative space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
              Creator Mood Radar
            </span>
            <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
              Build short-form creator briefs from verified public signals.
            </h1>
            <p className="max-w-2xl text-sm text-white/70 sm:text-base">
              Public Mood Radar helps short-form video creators translate live
              audience sentiment into hooks, formats, and story angles. Every
              score is traceable back to the exact sources used.
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-white/70">
              {[
                "Short-form creator packaging",
                "Traceable provenance",
                "No X/Twitter or Reddit scraping",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl space-y-6">
        <div className="dashboard-shell p-6 sm:p-8">
          <div className="dashboard-gradient" />
          <div className="dashboard-noise" />
          <div className="relative space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  Short-form creator brief inputs
                </h2>
                <p className="text-sm text-white/60">
                  Define the audience slice and see what signals are shaping
                  the conversation.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Fetching signals..." : "Generate short-form brief"}
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
              <label className="glass-panel rounded-2xl p-4">
                <span className="text-xs uppercase tracking-wide text-white/50">
                  Topic
                </span>
                <input
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="e.g. eco-friendly sneakers"
                  className="mt-2 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                />
              </label>
              <label className="glass-panel rounded-2xl p-4">
                <span className="text-xs uppercase tracking-wide text-white/50">
                  Region
                </span>
                <select
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                  className="mt-2 w-full bg-transparent text-sm text-white outline-none"
                >
                  {regionOptions.map((option) => (
                    <option key={option} value={option} className="text-black">
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="glass-panel rounded-2xl p-4">
                <span className="text-xs uppercase tracking-wide text-white/50">
                  Time window
                </span>
                <select
                  value={timeWindow}
                  onChange={(event) => setTimeWindow(event.target.value)}
                  className="mt-2 w-full bg-transparent text-sm text-white outline-none"
                >
                  {timeWindowOptions.map((option) => (
                    <option key={option} value={option} className="text-black">
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="glass-panel rounded-2xl p-4">
                <span className="text-xs uppercase tracking-wide text-white/50">
                  Source focus
                </span>
                <select
                  value={sourceFocus}
                  onChange={(event) => setSourceFocus(event.target.value)}
                  className="mt-2 w-full bg-transparent text-sm text-white outline-none"
                >
                  {sourceOptions.map((option) => (
                    <option key={option} value={option} className="text-black">
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Signals captured", value: snippets.length },
                {
                  label: "Unique sources",
                  value: new Set(snippets.map((item) => getHostname(item.url))).size,
                },
                { label: "Coverage focus", value: sourceFocus },
                { label: "Exclusions", value: "X/Twitter + Reddit" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="glass-panel rounded-2xl p-4"
                >
                  <p className="text-xs uppercase tracking-wide text-white/50">
                    {item.label}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              Creator-ready suggestions
            </h2>
            <p className="text-sm text-white/60">
              Each idea includes traceable sources and a transparent scoring
              breakdown.
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs text-white/70">
            Scores are directional, not definitive
          </span>
        </div>

        {suggestions.length ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {suggestions.map((suggestion) => (
              <article
                key={suggestion.id}
                className="glass-panel rounded-3xl p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {suggestion.title}
                    </h3>
                    <p className="mt-2 text-sm text-white/70">
                      {suggestion.summary}
                    </p>
                    <p className="mt-3 text-xs uppercase tracking-wide text-white/50">
                      Confidence: {suggestion.confidenceLabel}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-4 py-3 text-center">
                    <p className="text-xs uppercase text-white/50">Score</p>
                    <p className="text-2xl font-semibold text-white">
                      {suggestion.score}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${suggestion.confidence}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-white/50">
                    <span>Confidence</span>
                    <span>{suggestion.confidence}%</span>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase text-white/50">Signals</p>
                  <div className="mt-3 grid gap-3 text-sm text-white/70 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase text-white/50">
                        Relevance
                      </p>
                      <p className="text-base font-semibold text-white">
                        {Math.round(suggestion.signals.relevance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-white/50">Recency</p>
                      <p className="text-base font-semibold text-white">
                        {Math.round(suggestion.signals.recency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-white/50">
                        Diversity
                      </p>
                      <p className="text-base font-semibold text-white">
                        {Math.round(suggestion.signals.diversity)}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-white/50">
                    {suggestion.signals.rationale.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 space-y-3">
                  <p className="text-xs uppercase text-white/50">
                    Provenance
                  </p>
                  {suggestion.provenance.sources.map((source) => {
                    const parsedDate = source.publishedAt
                      ? new Date(source.publishedAt)
                      : null;
                    const dateLabel =
                      parsedDate && !Number.isNaN(parsedDate.getTime())
                        ? parsedDate.toLocaleDateString()
                        : "Date unavailable";

                    return (
                      <div
                        key={source.url}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-white/50">
                          <span>{source.domain}</span>
                          <span>{dateLabel}</span>
                        </div>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block text-sm font-semibold text-white hover:underline"
                        >
                          {source.title}
                        </a>
                        <p className="mt-2 text-xs text-white/60">
                          {source.snippet}
                        </p>
                      </div>
                    );
                  })}
                  <ul className="space-y-1 text-xs text-white/50">
                    {suggestion.provenance.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="glass-panel rounded-3xl p-8 text-center">
            <p className="text-sm text-white/70">
              Run a short-form brief to see suggestions with provenance.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

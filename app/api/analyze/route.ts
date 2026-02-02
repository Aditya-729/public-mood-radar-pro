import { NextResponse } from "next/server";

type AnalyzePayload = {
  niche: string;
  platform: string;
  audience: string;
  country?: string;
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

type StageEvent = {
  stage: "A" | "B" | "C" | "D" | "E";
  status: "start" | "progress" | "complete" | "error";
  message?: string;
  data?: unknown;
};

function extractJsonArray(text: string) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(value: string) {
  const grams = new Set<string>();
  for (let i = 0; i < value.length - 1; i += 1) {
    grams.add(value.slice(i, i + 2));
  }
  return grams;
}

function similarityScore(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aSet = bigrams(a);
  const bSet = bigrams(b);
  let matches = 0;
  aSet.forEach((gram) => {
    if (bSet.has(gram)) matches += 1;
  });
  return (2 * matches) / (aSet.size + bSet.size);
}

function dedupeSignals(items: Signal[]) {
  const result: Signal[] = [];
  const seenUrls = new Set<string>();
  const seenTitles: string[] = [];
  items.forEach((item) => {
    const titleKey = normalizeTitle(item.title);
    if (!titleKey || !item.url) return;
    if (seenUrls.has(item.url)) return;
    const isNearDuplicate = seenTitles.some(
      (seen) => similarityScore(seen, titleKey) >= 0.9
    );
    if (isNearDuplicate) return;
    seenUrls.add(item.url);
    seenTitles.push(titleKey);
    result.push(item);
  });
  return result;
}

async function runPerplexity(payload: AnalyzePayload) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing PERPLEXITY_API_KEY");
  }
  const baseUrl = process.env.PERPLEXITY_API_URL ?? "https://api.perplexity.ai";
  const endpoint = baseUrl.endsWith("/chat/completions")
    ? baseUrl
    : `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const prompt = `Find current trends, audience signals, and public discussions about "${payload.niche}" on "${payload.platform}". Target audience: "${payload.audience}".${payload.country ? ` Focus on ${payload.country}.` : ""}\nReturn ONLY a strict JSON array of items with fields:\n[\n  {\n    "title": "string",\n    "snippet": "string",\n    "url": "string",\n    "publishedAt": "ISO date string"\n  }\n]\nNo extra text, no markdown.`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.PERPLEXITY_MODEL ?? "sonar",
      messages: [
        { role: "system", content: "You are a precise data extractor." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Perplexity request failed: ${text}`);
  }

  const payloadJson = await response.json();
  const content =
    payloadJson?.choices?.[0]?.message?.content ??
    payloadJson?.choices?.[0]?.text ??
    "";

  const extracted = extractJsonArray(content) ?? [];
  const normalized = extracted
    .map((item: Partial<Signal>) => ({
      title: String(item.title ?? "").trim(),
      snippet: String(item.snippet ?? "").trim(),
      url: String(item.url ?? "").trim(),
      publishedAt: String(item.publishedAt ?? "").trim(),
    }))
    .filter((item: Signal) => item.title && item.url);

  const fallbackResults = Array.isArray(payloadJson?.search_results)
    ? payloadJson.search_results
        .map(
          (item: {
            title?: string;
            snippet?: string;
            url?: string;
            last_updated?: string;
            date?: string;
          }) => ({
            title: String(item.title ?? "").trim(),
            snippet: String(item.snippet ?? "").trim(),
            url: String(item.url ?? "").trim(),
            publishedAt: String(item.last_updated ?? item.date ?? "").trim(),
          })
        )
        .filter((item: Signal) => item.title && item.url)
    : [];

  return dedupeSignals(normalized.length ? normalized : fallbackResults);
}

async function runMino(goal: string) {
  const apiKey = process.env.MINO_API_KEY;
  const apiUrl = process.env.MINO_API_URL;
  const agentUrl = process.env.MINO_AGENT_URL ?? "https://example.com";
  if (!apiKey || !apiUrl) {
    throw new Error("Missing MINO_API_KEY or MINO_API_URL");
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      url: agentUrl,
      goal,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mino request failed: ${text}`);
  }

  const raw = await response.text();
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = extractJsonObject(raw);
  }

  if (!parsed) {
    throw new Error("Unable to parse Mino response.");
  }

  if (parsed.status && parsed.status !== "COMPLETED") {
    throw new Error(`Mino status: ${parsed.status}`);
  }

  return parsed.resultJson ?? parsed.result ?? parsed;
}

export async function POST(request: Request) {
  const body = (await request.json()) as AnalyzePayload;
  if (!body?.niche || !body?.platform || !body?.audience) {
    return NextResponse.json(
      { error: "Missing niche, platform, or audience." },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: StageEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      const run = async () => {
        try {
          send({
            stage: "A",
            status: "start",
            message: "Stage A: Fetching live signals…",
          });
          const signals = await runPerplexity(body);
          send({
            stage: "A",
            status: "complete",
            message: `Stage A complete: ${signals.length} signals`,
            data: { signals },
          });

          send({
            stage: "B",
            status: "start",
            message: "Stage B: Normalizing signals…",
          });
          const normalized = signals.map((signal) => ({
            ...signal,
            title: signal.title.trim(),
            snippet: signal.snippet.trim(),
          }));
          send({
            stage: "B",
            status: "complete",
            message: "Stage B complete: Signals normalized",
            data: { normalized },
          });

          send({
            stage: "C",
            status: "start",
            message: "Stage C: Extracting opportunities…",
          });
          const opportunitiesGoal = `You are analyzing creator opportunities. Using the signals below, return JSON ONLY:\n{\n  "opportunities": [\n    {\n      "title": "string",\n      "description": "string",\n      "platformFit": "string",\n      "audienceAngle": "string",\n      "evidenceIndexes": [number],\n      "newness": "string"\n    }\n  ],\n  "gaps": [\n    {\n      "gap": "string",\n      "whyNow": "string",\n      "suggestedContent": "string"\n    }\n  ]\n}\nSignals:\n${JSON.stringify({ niche: body.niche, platform: body.platform, audience: body.audience, country: body.country, signals: normalized })}\nNo markdown, no extra keys.`;
          const stageC = (await runMino(opportunitiesGoal)) as {
            opportunities?: Opportunity[];
            gaps?: OpportunityGap[];
          };
          send({
            stage: "C",
            status: "complete",
            message: "Stage C complete: Opportunities extracted",
            data: {
              opportunities: stageC.opportunities ?? [],
              gaps: stageC.gaps ?? [],
            },
          });

          send({
            stage: "D",
            status: "start",
            message: "Stage D: Scoring opportunity impact…",
          });
          const scoringGoal = `Score the opportunity list. Return JSON ONLY:\n{\n  "scored": [\n    {\n      "title": "string",\n      "score": number,\n      "risk": "string",\n      "effort": "string",\n      "rationale": "string",\n      "recommended": boolean\n    }\n  ]\n}\nInput:\n${JSON.stringify(stageC)}\nNo markdown, no extra keys.`;
          const stageD = (await runMino(scoringGoal)) as {
            scored?: OpportunityScore[];
          };
          send({
            stage: "D",
            status: "complete",
            message: "Stage D complete: Scores generated",
            data: { scored: stageD.scored ?? [] },
          });

          send({
            stage: "E",
            status: "start",
            message: "Stage E: Generating creator playbook…",
          });
          const playbookGoal = `Generate a creator playbook based on scored opportunities. Return JSON ONLY:\n{\n  "playbook": {\n    "positioning": "string",\n    "contentPillars": ["string"],\n    "weeklyPlan": ["string"],\n    "monetizationIdeas": ["string"],\n    "collaborationTargets": ["string"],\n    "watchouts": ["string"]\n  }\n}\nInput:\n${JSON.stringify({ opportunities: stageC, scored: stageD })}\nNo markdown, no extra keys.`;
          const stageE = (await runMino(playbookGoal)) as { playbook?: Playbook };
          send({
            stage: "E",
            status: "complete",
            message: "Stage E complete: Playbook ready",
            data: { playbook: stageE.playbook },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Pipeline error";
          send({
            stage: "A",
            status: "error",
            message,
          });
        } finally {
          controller.close();
        }
      };

      run();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

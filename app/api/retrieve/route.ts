import { NextResponse } from "next/server";
import type { Snippet } from "@/lib/models";

type RetrievePayload = {
  topic: string;
  region: string;
  timeWindow: string;
  sourceFocus: string;
};

function extractJsonArray(text: string) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) {
    return null;
  }
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
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
  const items = new Set<string>();
  for (let i = 0; i < value.length - 1; i += 1) {
    items.add(value.slice(i, i + 2));
  }
  return items;
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

function dedupeSnippets(items: Snippet[]) {
  const result: Snippet[] = [];
  const seenUrls = new Set<string>();
  const seenTitles: string[] = [];
  items.forEach((item) => {
    const titleKey = normalizeTitle(item.title);
    if (!titleKey || !item.snippet || !item.url) return;
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

function isExcludedSource(url: string) {
  const lower = url.toLowerCase();
  return (
    lower.includes("x.com/") ||
    lower.includes("twitter.com/") ||
    lower.includes("reddit.com/")
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as RetrievePayload;
  const { topic, region, timeWindow, sourceFocus } = body;

  if (!topic || !region || !timeWindow) {
    return NextResponse.json(
      { error: "Missing topic, region, or time window." },
      { status: 400 }
    );
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing PERPLEXITY_API_KEY." },
      { status: 500 }
    );
  }

  const prompt = `Find latest news, discussions, and public conversations about "${topic}" in "${region}" in the last ${timeWindow}. Source focus: ${sourceFocus}.
Exclude X/Twitter and Reddit sources. Only include sources with verifiable public URLs.
Return ONLY a strict JSON array of items with fields:
[
  {
    "title": "string",
    "snippet": "string",
    "url": "string",
    "publishedAt": "ISO date string"
  }
]
No extra text, no markdown.`;

  const baseUrl =
    process.env.PERPLEXITY_API_URL ?? "https://api.perplexity.ai";
  const endpoint = baseUrl.endsWith("/chat/completions")
    ? baseUrl
    : `${baseUrl.replace(/\/$/, "")}/chat/completions`;

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
    const errorText = await response.text();
    return NextResponse.json(
      {
        error: "Perplexity request failed.",
        errorType: "perplexity",
        details: errorText,
      },
      { status: 502 }
    );
  }

  const payload = await response.json();
  const content =
    payload?.choices?.[0]?.message?.content ??
    payload?.choices?.[0]?.text ??
    "";

  const extracted = extractJsonArray(content);
  const normalized = (extracted ?? [])
    .map((item: Partial<Snippet>) => ({
      title: String(item.title ?? "").trim(),
      snippet: String(item.snippet ?? "").trim(),
      url: String(item.url ?? "").trim(),
      publishedAt: String(item.publishedAt ?? "").trim(),
    }))
    .filter((item: Snippet) => item.title && item.snippet && item.url);

  const fallbackResults = Array.isArray(payload?.search_results)
    ? payload.search_results
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
        .filter((item: Snippet) => item.title && item.url)
    : [];

  const combined = (normalized.length ? normalized : fallbackResults) as Snippet[];
  const filtered = combined.filter((item: Snippet) => !isExcludedSource(item.url));
  const deduped = dedupeSnippets(filtered);

  if (!deduped.length) {
    return NextResponse.json(
      {
        error: "Perplexity returned no usable snippets.",
        errorType: "perplexity",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ snippets: deduped });
}

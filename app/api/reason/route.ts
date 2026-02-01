import { NextResponse } from "next/server";
import { z } from "zod";
import type { ClassifiedSnippet, NarrativeCluster, Snippet } from "@/lib/models";

type ReasonPayload = {
  topic: string;
  region: string;
  timeWindow: string;
  sourceFocus: string;
  snippets: Snippet[];
};

const classifiedSnippetSchema = z.object({
  index: z.number().int().nonnegative(),
  emotion: z.string().min(1),
  concern: z.string().min(1),
  narrative: z.string().min(1),
  cluster: z.string().min(1),
});

const narrativeClusterSchema = z.object({
  label: z.string().min(1),
  size: z.number().int().nonnegative(),
  exampleHeadlines: z.array(z.string()).default([]),
});

const minoResponseSchema = z.object({
  items: z.array(classifiedSnippetSchema),
  clusters: z.array(narrativeClusterSchema).optional(),
});

const MAX_SNIPPET_CHARS = 800;
const MAX_TITLE_CHARS = 160;
const MAX_TOTAL_CHARS = 12000;

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
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

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value;
  return value.slice(0, limit).trim();
}

function enforceSnippetBudget(snippets: Snippet[]) {
  const trimmed: Snippet[] = [];
  let totalChars = 0;
  snippets.forEach((snippet) => {
    const next = {
      ...snippet,
      title: truncate(snippet.title, MAX_TITLE_CHARS),
      snippet: truncate(snippet.snippet, MAX_SNIPPET_CHARS),
    };
    const size = next.title.length + next.snippet.length;
    if (totalChars + size > MAX_TOTAL_CHARS) return;
    totalChars += size;
    trimmed.push(next);
  });
  return trimmed;
}

export async function POST(request: Request) {
  const body = (await request.json()) as ReasonPayload;
  const { snippets, topic, region, timeWindow, sourceFocus } = body;

  if (!snippets?.length) {
    return NextResponse.json(
      { error: "Missing snippets for reasoning.", errorType: "validation" },
      { status: 400 }
    );
  }

  const apiKey = process.env.MINO_API_KEY;
  const apiUrl = process.env.MINO_API_URL;
  if (!apiKey || !apiUrl) {
    return NextResponse.json(
      { error: "Missing MINO_API_KEY or MINO_API_URL.", errorType: "mino" },
      { status: 500 }
    );
  }

  const constrainedSnippets = enforceSnippetBudget(snippets);
  if (!constrainedSnippets.length) {
    return NextResponse.json(
      { error: "Snippet budget exceeded.", errorType: "validation" },
      { status: 400 }
    );
  }

  const prompt = `You are a strict JSON classifier for public sentiment analysis.
Analyze the snippets and return ONLY JSON in this schema:
{
  "items": [
    {
      "index": number,
      "emotion": "string",
      "concern": "string",
      "narrative": "string",
      "cluster": "string"
    }
  ],
  "clusters": [
    {
      "label": "string",
      "size": number,
      "exampleHeadlines": ["string"]
    }
  ]
}
No markdown, no extra keys.`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.MINO_MODEL ?? "mino-latest",
      prompt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: "Mino request failed.", errorType: "mino", details: errorText },
      { status: 502 }
    );
  }

  const rawText = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = extractJsonObject(rawText);
  }

  if (!parsed) {
    return NextResponse.json(
      { error: "Unable to parse Mino response.", errorType: "malformed" },
      { status: 500 }
    );
  }

  const validation = minoResponseSchema.safeParse(parsed);
  if (!validation.success) {
    return NextResponse.json(
      {
        error: "Malformed Mino response.",
        errorType: "malformed",
        details: validation.error.flatten(),
      },
      { status: 500 }
    );
  }

  return NextResponse.json(validation.data as {
    items: ClassifiedSnippet[];
    clusters?: NarrativeCluster[];
  });
}

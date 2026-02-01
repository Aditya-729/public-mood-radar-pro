import type { NextApiRequest, NextApiResponse } from "next";
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { snippets, topic, region, timeWindow, sourceFocus } =
    req.body as ReasonPayload;

  if (!snippets?.length) {
    return res
      .status(400)
      .json({ error: "Missing snippets for reasoning.", errorType: "validation" });
  }

  const apiKey = process.env.MINO_API_KEY;
  const apiUrl = process.env.MINO_API_URL;
  const model = process.env.MINO_MODEL ?? "mino-latest";

  if (!apiKey || !apiUrl) {
    return res.status(500).json({
      error: "Missing MINO_API_KEY or MINO_API_URL",
    });
  }

  const constrainedSnippets = enforceSnippetBudget(snippets);
  if (!constrainedSnippets.length) {
    return res
      .status(400)
      .json({ error: "Snippet budget exceeded.", errorType: "validation" });
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
Snippets:
${JSON.stringify({
  topic,
  region,
  timeWindow,
  sourceFocus,
  snippets: constrainedSnippets,
})}
No markdown, no extra keys.`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res
        .status(response.status)
        .json({ error: "Mino API error", errorType: "mino", details: text });
    }

    const rawText = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = extractJsonObject(rawText);
    }

    if (!parsed) {
      return res
        .status(500)
        .json({ error: "Unable to parse Mino response.", errorType: "malformed" });
    }

    const validation = minoResponseSchema.safeParse(parsed);
    if (!validation.success) {
      return res.status(500).json({
        error: "Malformed Mino response.",
        errorType: "malformed",
        details: validation.error.flatten(),
      });
    }

    return res.status(200).json(validation.data as {
      items: ClassifiedSnippet[];
      clusters?: NarrativeCluster[];
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res
      .status(500)
      .json({ error: "Internal server error", details: message });
  }
}

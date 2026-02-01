import type { NextApiRequest, NextApiResponse } from "next";

type ReasonRequestBody = {
  prompt: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt } = req.body as ReasonRequestBody;

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt in request body" });
  }

  const apiKey = process.env.MINO_API_KEY;
  const apiUrl = process.env.MINO_API_URL;
  const model = process.env.MINO_MODEL;

  if (!apiKey || !apiUrl || !model) {
    return res.status(500).json({
      error: "Missing MINO_API_KEY, MINO_API_URL, or MINO_MODEL",
    });
  }

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
        .json({ error: "Mino API error", details: text });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res
      .status(500)
      .json({ error: "Internal server error", details: message });
  }
}

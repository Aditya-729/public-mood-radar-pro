export type Snippet = {
  title: string;
  snippet: string;
  url: string;
  publishedAt: string;
};

export type SourceSignal = {
  title: string;
  snippet: string;
  url: string;
  domain: string;
  publishedAt: string;
};

export type SuggestionSignals = {
  relevance: number;
  recency: number;
  diversity: number;
  rationale: string[];
};

export type Suggestion = {
  id: string;
  title: string;
  summary: string;
  score: number;
  confidence: number;
  confidenceLabel: string;
  signals: SuggestionSignals;
  provenance: {
    sources: SourceSignal[];
    notes: string[];
  };
};

export type Snippet = {
  title: string;
  snippet: string;
  url: string;
  publishedAt: string;
};

export type ClassifiedSnippet = {
  index: number;
  emotion: string;
  concern: string;
  narrative: string;
  cluster: string;
};

export type NarrativeCluster = {
  label: string;
  size: number;
  exampleHeadlines: string[];
};

export type EmotionStats = {
  emotion: string;
  count: number;
  percentage: number;
};

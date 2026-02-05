export function clamp(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

export function getHostname(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export function daysSince(dateString: string) {
  if (!dateString) return null;
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return null;
  const diffMs = Date.now() - parsed.getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
}

export function scoreRecency(days: number | null) {
  if (days === null) return 35;
  if (days <= 1) return 95;
  if (days <= 3) return 85;
  if (days <= 7) return 70;
  if (days <= 14) return 58;
  if (days <= 30) return 45;
  return 30;
}

export function scoreRelevance(topic: string, text: string) {
  const normalizedTopic = topic.toLowerCase().trim();
  const normalizedText = text.toLowerCase();
  if (!normalizedTopic) return 40;
  const parts = normalizedTopic.split(/\s+/).filter(Boolean);
  const hits = parts.filter((part) => normalizedText.includes(part)).length;
  if (!parts.length) return 40;
  return clamp((hits / parts.length) * 100, 35, 100);
}

export function scoreDiversity(uniqueDomains: number) {
  if (uniqueDomains >= 5) return 90;
  if (uniqueDomains >= 4) return 80;
  if (uniqueDomains >= 3) return 70;
  if (uniqueDomains >= 2) return 55;
  return 40;
}

export function scoreConfidence({
  sourceCount,
  diversityScore,
  recencyScore,
}: {
  sourceCount: number;
  diversityScore: number;
  recencyScore: number;
}) {
  const sourceScore = clamp(sourceCount * 18, 35, 95);
  return clamp(
    weightedScore([
      { value: sourceScore, weight: 0.4 },
      { value: diversityScore, weight: 0.3 },
      { value: recencyScore, weight: 0.3 },
    ])
  );
}

export function confidenceLabel(score: number) {
  if (score >= 80) return "High";
  if (score >= 60) return "Medium";
  return "Early signal";
}

export function weightedScore(values: Array<{ value: number; weight: number }>) {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return 0;
  const sum = values.reduce((acc, item) => acc + item.value * item.weight, 0);
  return Math.round(sum / totalWeight);
}

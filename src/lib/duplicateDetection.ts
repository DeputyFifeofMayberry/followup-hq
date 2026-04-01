import type { DuplicateCandidate, DuplicateReview, FollowUpItem } from '../types';

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(' ')
      .filter((token) => token.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

export function buildPairKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

function scorePair(a: FollowUpItem, b: FollowUpItem): DuplicateCandidate | null {
  let score = 0;
  const reasons: string[] = [];

  const titleSimilarity = jaccard(tokenize(a.title), tokenize(b.title));
  const summarySimilarity = jaccard(tokenize(a.summary), tokenize(b.summary));
  const actionSimilarity = jaccard(tokenize(a.nextAction), tokenize(b.nextAction));
  const tagSimilarity = jaccard(new Set(a.tags.map(normalizeText)), new Set(b.tags.map(normalizeText)));

  if (normalizeText(a.title) === normalizeText(b.title) && normalizeText(a.title) !== '') {
    score += 55;
    reasons.push('Same title');
  } else if (titleSimilarity >= 0.7) {
    score += 35;
    reasons.push('Very similar title');
  } else if (titleSimilarity >= 0.5) {
    score += 20;
    reasons.push('Related title');
  }

  if (normalizeText(a.project) !== '' && normalizeText(a.project) === normalizeText(b.project)) {
    score += 18;
    reasons.push('Same project');
  }

  if (normalizeText(a.owner) !== '' && normalizeText(a.owner) === normalizeText(b.owner)) {
    score += 8;
    reasons.push('Same owner');
  }

  if (normalizeText(a.sourceRef) !== '' && normalizeText(a.sourceRef) === normalizeText(b.sourceRef)) {
    score += 40;
    reasons.push('Same source reference');
  }

  if (summarySimilarity >= 0.7) {
    score += 22;
    reasons.push('Very similar summary');
  } else if (summarySimilarity >= 0.45) {
    score += 10;
    reasons.push('Related summary');
  }

  if (actionSimilarity >= 0.7) {
    score += 12;
    reasons.push('Same next action');
  }

  if (tagSimilarity >= 0.5 && a.tags.length > 0 && b.tags.length > 0) {
    score += 8;
    reasons.push('Overlapping tags');
  }

  const dueDelta = Math.abs(new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()) / 86400000;
  if (dueDelta <= 1) {
    score += 6;
    reasons.push('Near same due date');
  }

  if (score < 45) return null;
  return { itemId: b.id, score, reasons };
}

export function detectDuplicateReviews(items: FollowUpItem[], dismissedPairKeys: string[]): DuplicateReview[] {
  const dismissed = new Set(dismissedPairKeys);
  const byItem = new Map<string, DuplicateCandidate[]>();

  for (let index = 0; index < items.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < items.length; otherIndex += 1) {
      const left = items[index];
      const right = items[otherIndex];
      const pairKey = buildPairKey(left.id, right.id);
      if (dismissed.has(pairKey)) continue;

      const leftToRight = scorePair(left, right);
      if (!leftToRight) continue;
      const rightToLeft: DuplicateCandidate = { itemId: left.id, score: leftToRight.score, reasons: leftToRight.reasons };

      byItem.set(left.id, [...(byItem.get(left.id) ?? []), leftToRight]);
      byItem.set(right.id, [...(byItem.get(right.id) ?? []), rightToLeft]);
    }
  }

  return items
    .map((item) => ({
      itemId: item.id,
      candidates: (byItem.get(item.id) ?? []).sort((a, b) => b.score - a.score),
    }))
    .filter((review) => review.candidates.length > 0);
}

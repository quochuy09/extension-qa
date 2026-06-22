export const severityRank = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function sortFindingsBySeverity(findings) {
  return [...findings].sort((left, right) => {
    const leftRank = severityRank[String(left.severity || '').toLowerCase()] ?? 0;
    const rightRank = severityRank[String(right.severity || '').toLowerCase()] ?? 0;
    return rightRank - leftRank;
  });
}

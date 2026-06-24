export function getScoreReportKey(examId: string, score: number, rank: number) {
  return `${examId}:${rank}:${score}`;
}

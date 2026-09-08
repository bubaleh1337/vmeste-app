import { calculateProgressPercent, visualProgressPercent } from "@/lib/money";

export interface ParticipantContribution {
  id: string;
  name: string;
  color: string;
  amountMinor: bigint;
}

export interface ParticipantProgressSegment extends ParticipantContribution {
  widthPercent: number;
}

export function buildParticipantProgressSegments(
  contributions: readonly ParticipantContribution[],
  actualSavedMinor: bigint,
  targetAmountMinor: bigint,
): ParticipantProgressSegment[] {
  const positive = contributions.filter((item) => item.amountMinor > 0n);
  const positiveTotal = positive.reduce((sum, item) => sum + item.amountMinor, 0n);
  const filledPercent = visualProgressPercent(calculateProgressPercent(targetAmountMinor, actualSavedMinor));
  if (positiveTotal <= 0n || filledPercent <= 0) return [];

  let allocated = 0;
  return positive.map((item, index) => {
    const isLast = index === positive.length - 1;
    const sharePercent = Number((item.amountMinor * 1_000_000n) / positiveTotal) / 10_000;
    const widthPercent = isLast
      ? Math.max(0, filledPercent - allocated)
      : filledPercent * sharePercent / 100;
    allocated += widthPercent;
    return { ...item, widthPercent };
  });
}

import { describe, expect, it } from "vitest";
import { buildParticipantProgressSegments } from "./participant-progress";

const people = [
  { id: "kate", name: "Катя", color: "#C88F87", amountMinor: 3_000_00n },
  { id: "nikita", name: "Никита", color: "#7298B8", amountMinor: 2_000_00n },
];

describe("participant progress segments", () => {
  it("maps each net contribution to its part of the goal", () => {
    const segments = buildParticipantProgressSegments(people, 5_000_00n, 10_000_00n);
    expect(segments.map((item) => item.widthPercent)).toEqual([30, 20]);
    expect(segments.reduce((sum, item) => sum + item.widthPercent, 0)).toBe(50);
  });

  it("caps the visual bar at one hundred percent", () => {
    const segments = buildParticipantProgressSegments(people, 5_000_00n, 4_000_00n);
    expect(segments.map((item) => item.widthPercent)).toEqual([60, 40]);
  });

  it("keeps the displayed total accurate when one participant has a negative net", () => {
    const segments = buildParticipantProgressSegments([
      { ...people[0], amountMinor: 6_000_00n },
      { ...people[1], amountMinor: -1_000_00n },
    ], 5_000_00n, 10_000_00n);
    expect(segments).toHaveLength(1);
    expect(segments[0].widthPercent).toBe(50);
  });

  it("returns no colored segments for a non-positive total", () => {
    expect(buildParticipantProgressSegments(people, 0n, 10_000_00n)).toEqual([]);
  });
});

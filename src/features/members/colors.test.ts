import { describe, expect, it } from "vitest";
import {
  fallbackParticipantColor,
  isParticipantColor,
  participantColorText,
  resolveParticipantColor,
} from "./colors";

describe("participant colors", () => {
  it("accepts six-digit colors and normalizes them", () => {
    expect(isParticipantColor("#c88f87")).toBe(true);
    expect(isParticipantColor("#fff")).toBe(false);
    expect(resolveParticipantColor("#c88f87", "user-1")).toBe("#C88F87");
  });

  it("uses a stable fallback for profiles without a saved color", () => {
    expect(fallbackParticipantColor("user-1")).toBe(fallbackParticipantColor("user-1"));
    expect(resolveParticipantColor(null, "user-1")).toBe(fallbackParticipantColor("user-1"));
  });

  it("chooses readable text for light and dark colors", () => {
    expect(participantColorText("#F4DDE4")).toBe("#282723");
    expect(participantColorText("#53624F")).toBe("#FFFFFF");
  });
});

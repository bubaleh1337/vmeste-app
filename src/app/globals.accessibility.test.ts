import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

function channel(value: number) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const [red, green, blue] = [1, 3, 5].map((start) => channel(Number.parseInt(hex.slice(start, start + 2), 16)));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastWithWhite(hex: string) {
  return 1.05 / (luminance(hex) + 0.05);
}

describe("theme accessibility", () => {
  it("uses the dark theme token for primary actions", () => {
    expect(css).toMatch(/\.primary-button\s*\{[^}]*background:\s*var\(--sage-dark\)[^}]*color:\s*white/s);
  });

  it("keeps white primary-button text at WCAG AA contrast in every theme", () => {
    const primaryColors = [...css.matchAll(/--sage-dark:\s*(#[0-9a-f]{6})/gi)].map((match) => match[1]);
    expect(primaryColors.length).toBeGreaterThanOrEqual(7);
    for (const color of primaryColors) expect(contrastWithWhite(color)).toBeGreaterThanOrEqual(4.5);
  });

  it("provides a visible keyboard focus ring for interactive controls", () => {
    expect(css).toMatch(/a:focus-visible/);
    expect(css).toMatch(/summary:focus-visible/);
    expect(css).toMatch(/outline:\s*3px solid var\(--text\)/);
  });
});

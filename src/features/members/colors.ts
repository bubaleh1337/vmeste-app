export const PARTICIPANT_COLOR_PALETTE = [
  "#C88F87",
  "#7298B8",
  "#C2A15C",
  "#8A7FA8",
  "#6F806A",
  "#B9795D",
  "#5F958C",
  "#AD7895",
] as const;

const PARTICIPANT_COLOR_PATTERN = /^#[0-9A-F]{6}$/;

export function isParticipantColor(value: string): boolean {
  return PARTICIPANT_COLOR_PATTERN.test(value.toUpperCase());
}

export function fallbackParticipantColor(userId: string): string {
  let hash = 0;
  for (const character of userId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return PARTICIPANT_COLOR_PALETTE[hash % PARTICIPANT_COLOR_PALETTE.length];
}

export function resolveParticipantColor(value: string | null | undefined, userId: string): string {
  const normalized = value?.toUpperCase();
  return normalized && isParticipantColor(normalized) ? normalized : fallbackParticipantColor(userId);
}

export function participantColorText(color: string): "#282723" | "#FFFFFF" {
  const normalized = color.replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return "#282723";
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 255_000;
  return luminance > 0.62 ? "#282723" : "#FFFFFF";
}

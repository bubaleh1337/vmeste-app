export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("ru-RU", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

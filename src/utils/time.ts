const clockPattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isClockTime(value: string) {
  return clockPattern.test(value.trim());
}

export function normalizeClockTime(value: string, fallback: string) {
  const trimmed = value.trim();
  if (isClockTime(trimmed)) {
    return trimmed;
  }

  const compact = trimmed.replace(/[^0-9]/g, '');
  if (compact.length === 3 || compact.length === 4) {
    const padded = compact.padStart(4, '0');
    const normalized = `${padded.slice(0, 2)}:${padded.slice(2)}`;
    if (isClockTime(normalized)) {
      return normalized;
    }
  }

  return fallback;
}

export function splitClockTime(value: string, fallback = '00:00') {
  const normalized = normalizeClockTime(value, fallback);
  const [hour, minute] = normalized.split(':').map(Number);

  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

export function clockTimeToMinutes(value: string, fallback = '00:00') {
  const { hour, minute } = splitClockTime(value, fallback);
  return hour * 60 + minute;
}

export function minutesToClockTime(value: number) {
  const minutesPerDay = 24 * 60;
  const normalized = ((Math.round(value) % minutesPerDay) + minutesPerDay) % minutesPerDay;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function getCurrentClockMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

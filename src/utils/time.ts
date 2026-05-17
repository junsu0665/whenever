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

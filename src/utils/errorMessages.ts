function getObjectField(value: unknown, field: string) {
  if (typeof value !== 'object' || value === null || !(field in value)) {
    return undefined;
  }

  return (value as Record<string, unknown>)[field];
}

function parseJsonMessage(message: string) {
  const trimmed = message.trim();

  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function getStatus(value: unknown) {
  const parsedValue = typeof value === 'string' ? parseJsonMessage(value) : null;
  const directStatus = getObjectField(value, 'status');

  if (typeof directStatus === 'number') {
    return directStatus;
  }

  const parsedValueStatus = getObjectField(parsedValue, 'status');

  if (typeof parsedValueStatus === 'number') {
    return parsedValueStatus;
  }

  const message = getObjectField(value, 'message');
  const parsed = typeof message === 'string' ? parseJsonMessage(message) : null;
  const parsedStatus = getObjectField(parsed, 'status');

  return typeof parsedStatus === 'number' ? parsedStatus : undefined;
}

function getErrorCode(value: unknown) {
  const parsedValue = typeof value === 'string' ? parseJsonMessage(value) : null;
  const directCode = getObjectField(value, 'code') ?? getObjectField(value, 'error_code');

  if (typeof directCode === 'string') {
    return directCode;
  }

  const parsedValueCode = getObjectField(parsedValue, 'code') ?? getObjectField(parsedValue, 'error_code');

  if (typeof parsedValueCode === 'string') {
    return parsedValueCode;
  }

  const message = getObjectField(value, 'message');
  const parsed = typeof message === 'string' ? parseJsonMessage(message) : null;
  const parsedCode = getObjectField(parsed, 'code') ?? getObjectField(parsed, 'error_code');

  return typeof parsedCode === 'string' ? parsedCode : undefined;
}

function getMessage(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  const message = getObjectField(value, 'message') ?? getObjectField(value, 'msg') ?? getObjectField(value, 'error_description') ?? getObjectField(value, 'error');

  return typeof message === 'string' ? message : undefined;
}

export function getFriendlyErrorMessage(error: unknown, fallback: string) {
  const status = getStatus(error);
  const code = getErrorCode(error);
  const message = getMessage(error);

  if (status && [502, 503, 504, 520, 521, 522, 523, 524, 530].includes(status)) {
    return `서버가 일시적으로 응답하지 않아요. 잠시 후 다시 시도해 주세요. (${status})`;
  }

  if (/failed to fetch|fetch failed|network request failed/i.test(message ?? '')) {
    return '서버에 연결하지 못했어요. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.';
  }

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message ?? '')) {
    return '이메일 또는 비밀번호를 확인해 주세요.';
  }

  if (/email not confirmed/i.test(message ?? '')) {
    return '이메일 인증을 완료한 뒤 로그인해 주세요.';
  }

  if (/user already registered|already registered/i.test(message ?? '')) {
    return '이미 가입된 이메일이에요. 로그인해 주세요.';
  }

  if (message && !parseJsonMessage(message)) {
    return message;
  }

  return fallback;
}

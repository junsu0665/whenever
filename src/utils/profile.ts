export function formatClassName(className: string) {
  const normalizedClassName = className.trim().replace(/\s+/g, '');

  if (!normalizedClassName) {
    return '';
  }

  return normalizedClassName.endsWith('반') ? normalizedClassName : `${normalizedClassName}반`;
}

export function formatGradeClass(grade: number, className: string) {
  const formattedClassName = formatClassName(className);

  return formattedClassName ? `${grade}학년 ${formattedClassName}` : `${grade}학년`;
}

export function formatPhoneNumberInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function normalizeKoreanMobileNumber(value: string) {
  const digits = value.replace(/\D/g, '');

  if (digits.startsWith('010') && digits.length === 11) {
    return `+82${digits.slice(1)}`;
  }

  if (digits.startsWith('8210') && digits.length === 12) {
    return `+${digits}`;
  }

  throw new Error('휴대폰 번호는 010으로 시작하는 11자리 번호를 입력해 주세요.');
}

export function isValidKoreanMobileNumber(value: string) {
  try {
    normalizeKoreanMobileNumber(value);
    return true;
  } catch {
    return false;
  }
}

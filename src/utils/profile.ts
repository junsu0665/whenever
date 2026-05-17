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

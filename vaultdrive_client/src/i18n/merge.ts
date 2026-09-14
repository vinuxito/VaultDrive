type TranslationRecord = Record<string, unknown>;

function isTranslationRecord(value: unknown): value is TranslationRecord {
  return typeof value === "object" && value !== null;
}

export function deepMerge(target: unknown, source: unknown): unknown {
  if (!isTranslationRecord(target)) {
    return source;
  }
  if (!isTranslationRecord(source)) {
    return target;
  }
  
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    if (isTranslationRecord(sourceValue) && key in target) {
      const mergedValue = deepMerge(target[key], sourceValue);
      if (isTranslationRecord(mergedValue)) {
        Object.assign(sourceValue, mergedValue);
      }
    }
  }
  Object.assign(target, source);
  return target;
}

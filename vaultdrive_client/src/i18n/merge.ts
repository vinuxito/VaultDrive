export function deepMerge(target: any, source: any) {
  if (typeof target !== "object" || target === null) {
    return source;
  }
  if (typeof source !== "object" || source === null) {
    return target;
  }
  
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && key in target) {
      Object.assign(source[key], deepMerge(target[key], source[key]));
    }
  }
  Object.assign(target || {}, source);
  return target;
}

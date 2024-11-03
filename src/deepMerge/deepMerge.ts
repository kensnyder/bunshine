export default function deepMerge(target: any, source: any) {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'object') {
      if (!target[key]) {
        target[key] = {};
      }
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

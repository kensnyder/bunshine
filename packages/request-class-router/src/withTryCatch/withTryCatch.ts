export default function withTryCatch({
  label = 'Error',
  defaultReturn = undefined,
  func,
}: {
  label?: string;
  defaultReturn?: any;
  func: (...args: any[]) => any;
}) {
  return (...args: any[]) => {
    try {
      return func(...args);
    } catch (e) {
      const error = e as Error;
      console.error(`${label}: ${error.message}`);
      return defaultReturn;
    }
  };
}

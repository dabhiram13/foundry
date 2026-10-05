export async function withRequestDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  message: string,
  milliseconds = 10_000,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message));
      controller.abort();
    }, milliseconds);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

export async function withDependencyTimeout<T>(
  operation: Promise<T>,
  dependency: string,
  timeoutMs = 2_000,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${dependency} health check timed out`));
    }, timeoutMs);
    timer.unref();
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

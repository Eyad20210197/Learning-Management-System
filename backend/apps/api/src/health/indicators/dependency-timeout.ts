export async function withDependencyTimeout(
  operation: Promise<void>,
  dependency: string,
  timeoutMs = 2_000,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${dependency} health check timed out`));
    }, timeoutMs);
    timer.unref();
  });

  try {
    await Promise.race([operation, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

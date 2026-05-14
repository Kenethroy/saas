export function withTimeout(promise, ms, errorFactory = null) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return promise;
  }

  let timeoutId;

  const timeoutPromise = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      const err = typeof errorFactory === "function"
        ? errorFactory()
        : new Error(`Operation timed out after ${ms}ms`);
      reject(err);
    }, ms);

    timeoutId.unref?.();
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

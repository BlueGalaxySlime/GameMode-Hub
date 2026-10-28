/**
 * Keep an unresponsive Decky backend call from locking up the SteamHub UI.
 * A timed-out request can finish later, but its result is ignored.
 */
export class RequestTimeoutError extends Error {
  constructor() {
    super("Przekroczono czas oczekiwania na odpowiedź. Spróbuj ponownie.");
    this.name = "RequestTimeoutError";
  }
}

export async function withTimeout<T>(request: Promise<T>, milliseconds: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race<T>([
      request,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new RequestTimeoutError()), milliseconds);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

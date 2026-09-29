/**
 * @file account/lock.ts
 *
 * Shared write lock for account persistence. Both the account repository
 * and the credential repository draw on the same lock so that an account
 * and its credential can be stored atomically: either both are persisted
 * or neither is, and concurrent registration attempts for the same
 * normalized email cannot both succeed.
 */

/**
 * A simple serialized mutex backed by chained promises.
 *
 * Each `withLock` call waits for the previous holder to release before
 * running, and resolves the next waiter when the operation completes —
 * even if that operation throws.
 */
export class AccountWriteLock {
  private tail: Promise<void> = Promise.resolve();

  async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release: () => void = () => undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  /** Reset the lock. Intended for tests only. */
  reset(): void {
    this.tail = Promise.resolve();
  }
}

export type { AccountWriteLock as AccountMutex };
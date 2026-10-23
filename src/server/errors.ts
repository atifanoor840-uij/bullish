/** Thrown by handlers; the API router turns it into `{ error }` with this status. */
export class HttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

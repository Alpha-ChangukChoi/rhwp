export class SessionNotFoundError extends Error {
  constructor(id: string) {
    super(`session not found: ${id}`);
    this.name = 'SessionNotFoundError';
  }
}

export class SessionExpiredError extends Error {
  constructor(id: string) {
    super(`session expired: ${id}`);
    this.name = 'SessionExpiredError';
  }
}

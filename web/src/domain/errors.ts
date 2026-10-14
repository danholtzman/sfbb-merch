export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

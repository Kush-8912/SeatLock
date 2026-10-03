// Errors thrown deliberately by application code. Anything else reaching the
// error handler is treated as an unexpected 500.
export class AppError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(msg, opts) { return new AppError(400, msg, opts); }
  static unauthorized(msg = 'Please log in to continue') { return new AppError(401, msg, { code: 'UNAUTHENTICATED' }); }
  static forbidden(msg = 'You do not have permission to do that') { return new AppError(403, msg, { code: 'FORBIDDEN' }); }
  static notFound(what = 'Resource') { return new AppError(404, `${what} not found`, { code: 'NOT_FOUND' }); }
  static conflict(msg, opts) { return new AppError(409, msg, { code: 'CONFLICT', ...opts }); }
  static gone(msg, opts) { return new AppError(410, msg, { code: 'GONE', ...opts }); }
}

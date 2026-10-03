// Express 5 forwards rejected promises to the error handler on its own; this
// wrapper keeps handlers explicit and portable.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

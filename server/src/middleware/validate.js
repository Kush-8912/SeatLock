import { AppError } from '../utils/AppError.js';

// Validates and *replaces* req[part] with the parsed value so handlers only
// ever see coerced, whitelisted input.
export const validate = (schema, part = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[part]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(AppError.badRequest('Some fields are invalid', { code: 'VALIDATION_ERROR', details }));
  }
  if (part === 'query') req.validatedQuery = result.data;
  else req[part] = result.data;
  next();
};

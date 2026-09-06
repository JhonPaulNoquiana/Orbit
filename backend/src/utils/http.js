export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export function requireFields(body, fields) {
  for (const field of fields) {
    if (typeof body[field] !== 'string' || !body[field].trim()) {
      throw new HttpError(400, `${field} is required`);
    }
  }
}

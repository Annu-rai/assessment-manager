// 404 handler — reached when no route matched.
export function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Not found: ${req.method} ${req.originalUrl}`));
}

// Central error handler. Normalises Mongoose/JWT errors into clean JSON.
export function errorHandler(err, req, res, _next) {
  let status = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message || 'Server error';

  // Duplicate key (e.g. email already registered)
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || { field: '' })[0];
    message = `That ${field} is already in use`;
  }

  // Mongoose validation
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  // Bad ObjectId
  if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  }

  res.status(status).json({
    message,
    ...(process.env.NODE_ENV === 'production' ? {} : { stack: err.stack }),
  });
}

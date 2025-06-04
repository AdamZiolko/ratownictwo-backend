const securityLogger = require('./securityLogger');

/**
 * Global error handling middleware with security logging
 */
const globalErrorHandler = (err, req, res, next) => {
  // Log the error for debugging
  console.error('Global Error Handler:', err);

  // Security-related error logging
  if (isSecurityError(err)) {
    securityLogger.logSecurityViolation(req, {
      error: err.message,
      stack: err.stack,
      type: err.name || 'SecurityError',
      userId: req.userId || null,
      userAgent: req.get('User-Agent'),
      severity: getSeverityLevel(err)
    });
  }

  // Default error response
  let statusCode = err.statusCode || err.status || 500;
  let message = 'Wewnętrzny błąd serwera';
  // Handle specific error types
  switch (err.name) {    case 'SyntaxError':
      // Handle JSON parsing errors
      if (err.message.includes('JSON') || err.type === 'entity.parse.failed') {
        statusCode = 400;
        message = 'Nieprawidłowy format JSON w treści żądania';
        
        // Log the malformed JSON for debugging
        securityLogger.logger.warn('JSON parsing error', {
          event: 'JSON_PARSE_ERROR',
          message: 'Malformed JSON received',
          details: {
            body: err.body || req.rawBody?.substring(0, 200) || 'unknown',
            error: err.message,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress,
            contentType: req.get('Content-Type'),
            contentLength: req.get('Content-Length'),
            url: req.originalUrl,
            method: req.method
          },
          timestamp: new Date().toISOString()
        });
        
        // Also log to console for immediate debugging
        console.error('JSON Parse Error Details:', {
          url: req.originalUrl,
          method: req.method,
          rawBody: req.rawBody?.substring(0, 200),
          errorBody: err.body,
          contentType: req.get('Content-Type')
        });
      }
      break;
    case 'ValidationError':
      statusCode = 400;
      message = 'Błąd walidacji';
      break;
    case 'UnauthorizedError':
    case 'JsonWebTokenError':
    case 'TokenExpiredError':
      statusCode = 401;
      message = 'Brak autoryzacji';
      break;
    case 'ForbiddenError':
      statusCode = 403;
      message = 'Dostęp zabroniony';
      break;
    case 'NotFoundError':
      statusCode = 404;
      message = 'Nie znaleziono';
      break;
    case 'ConflictError':
      statusCode = 409;
      message = 'Konflikt';
      break;
    case 'TooManyRequestsError':
      statusCode = 429;
      message = 'Zbyt wiele żądań';
      break;
    case 'MulterError':
      statusCode = handleMulterError(err);
      message = getMulterErrorMessage(err);
      break;
  }

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
    const errorResponse = {
    success: false,
    message: message,
    ...(isDevelopment && { 
      error: err.message,
      stack: err.stack 
    }),
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    // Add additional context for JSON parsing errors
    ...(err.name === 'SyntaxError' && err.type === 'entity.parse.failed' && {
      hint: 'Check that your JSON is properly formatted without escaped quotes',
      receivedData: req.rawBody?.substring(0, 100) + (req.rawBody?.length > 100 ? '...' : '')
    })
  };

  res.status(statusCode).json(errorResponse);
};

/**
 * Check if error is security-related
 */
function isSecurityError(err) {
  const securityErrors = [
    'UnauthorizedError',
    'JsonWebTokenError', 
    'TokenExpiredError',
    'ForbiddenError',
    'AccountLockedError',
    'TooManyRequestsError',
    'FileValidationError',
    'PathTraversalError',
    'MaliciousFileError'
  ];
  
  return securityErrors.includes(err.name) || 
         err.message.toLowerCase().includes('security') ||
         err.message.toLowerCase().includes('unauthorized') ||
         err.message.toLowerCase().includes('forbidden');
}

/**
 * Get severity level for security logging
 */
function getSeverityLevel(err) {
  const criticalErrors = ['PathTraversalError', 'MaliciousFileError'];
  const highErrors = ['AccountLockedError', 'TooManyRequestsError'];
  const mediumErrors = ['UnauthorizedError', 'ForbiddenError'];
  
  if (criticalErrors.includes(err.name)) return 'critical';
  if (highErrors.includes(err.name)) return 'high';
  if (mediumErrors.includes(err.name)) return 'medium';
  return 'low';
}

/**
 * Handle Multer file upload errors
 */
function handleMulterError(err) {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return 413;
    case 'LIMIT_FILE_COUNT':
      return 400;
    case 'LIMIT_UNEXPECTED_FILE':
      return 400;
    case 'LIMIT_FIELD_KEY':
    case 'LIMIT_FIELD_VALUE':
    case 'LIMIT_FIELD_COUNT':
      return 400;
    default:
      return 400;
  }
}

/**
 * Get user-friendly message for Multer errors
 */
function getMulterErrorMessage(err) {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return 'Plik jest zbyt duży';
    case 'LIMIT_FILE_COUNT':
      return 'Zbyt wiele plików';
    case 'LIMIT_UNEXPECTED_FILE':
      return 'Nieoczekiwane pole pliku';
    case 'LIMIT_FIELD_KEY':
      return 'Nazwa pola jest zbyt długa';
    case 'LIMIT_FIELD_VALUE':
      return 'Wartość pola jest zbyt długa';
    case 'LIMIT_FIELD_COUNT':
      return 'Zbyt wiele pól';
    default:
      return 'Błąd przesyłania pliku';
  }
}

/**
 * 404 handler for unmatched routes
 */
const notFoundHandler = (req, res, next) => {
  securityLogger.logUnauthorizedAccess(req, {
    reason: 'ROUTE_NOT_FOUND',
    requestedPath: req.originalUrl,
    method: req.method
  });

  res.status(404).json({
    success: false,
    message: 'Nie znaleziono ścieżki',
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  });
};

module.exports = {
  globalErrorHandler,
  notFoundHandler
};

const winston = require('winston');
const path = require('path');
const fs = require('fs');

class SecurityLogger {
  constructor() {
    // Utwórz katalog logs jeśli nie istnieje
    const logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'ratownictwo-security' },
      transports: [
        // Logi błędów bezpieczeństwa
        new winston.transports.File({
          filename: path.join(logsDir, 'security-errors.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        
        // Logi ostrzeżeń bezpieczeństwa
        new winston.transports.File({
          filename: path.join(logsDir, 'security-warnings.log'),
          level: 'warn',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        
        // Wszystkie logi bezpieczeństwa
        new winston.transports.File({
          filename: path.join(logsDir, 'security-combined.log'),
          maxsize: 10485760, // 10MB
          maxFiles: 10,
        })
      ]
    });

    // W środowisku deweloperskim dodaj również logi do konsoli
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }));
    }
  }

  // Pomocnicza funkcja do wyciągnięcia informacji o żądaniu
  extractRequestInfo(req) {
    return {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString(),
      sessionId: req.sessionID,
      userId: req.user ? req.user.id : null
    };
  }

  logFailedLogin(req, details = {}) {
    const requestInfo = this.extractRequestInfo(req);
    
    this.logger.warn('Failed login attempt', {
      event: 'FAILED_LOGIN',
      ...requestInfo,
      details: {
        username: details.username,
        reason: details.reason,
        attemptNumber: details.attemptNumber,
        ...details
      }
    });
  }

  logSuccessfulLogin(req, userId, details = {}) {
    const requestInfo = this.extractRequestInfo(req);
    
    this.logger.info('Successful login', {
      event: 'SUCCESSFUL_LOGIN',
      ...requestInfo,
      userId,
      details
    });
  }

  logLogout(req, userId, details = {}) {
    const requestInfo = this.extractRequestInfo(req);
    
    this.logger.info('User logout', {
      event: 'USER_LOGOUT',
      ...requestInfo,
      userId,
      details
    });
  }

  logUnauthorizedAccess(req, details = {}) {
    const requestInfo = this.extractRequestInfo(req);
    
    this.logger.warn('Unauthorized access attempt', {
      event: 'UNAUTHORIZED_ACCESS',
      ...requestInfo,
      details: {
        requiredRole: details.requiredRole,
        userRole: details.userRole,
        resource: details.resource,
        ...details
      }
    });
  }

  logSuspiciousActivity(req, activity, details = {}) {
    const requestInfo = this.extractRequestInfo(req);
    
    this.logger.warn('Suspicious activity detected', {
      event: 'SUSPICIOUS_ACTIVITY',
      ...requestInfo,
      activity,
      details,
      severity: details.severity || 'medium'
    });
  }

  logFileUpload(req, filename, fileSize, details = {}) {
    const requestInfo = this.extractRequestInfo(req);
    
    this.logger.info('File uploaded', {
      event: 'FILE_UPLOAD',
      ...requestInfo,
      details: {
        filename,
        fileSize,
        uploadPath: details.uploadPath,
        originalName: details.originalName,
        ...details
      }
    });
  }

  logFileDownload(req, filename, details = {}) {
    const requestInfo = this.extractRequestInfo(req);
    
    this.logger.info('File downloaded', {
      event: 'FILE_DOWNLOAD',
      ...requestInfo,
      details: {
        filename,
        ...details
      }
    });
  }

  logSecurityViolation(req, violation, details = {}) {
    const requestInfo = this.extractRequestInfo(req);
    
    this.logger.error('Security violation', {
      event: 'SECURITY_VIOLATION',
      ...requestInfo,
      violation,
      details,
      severity: details.severity || 'high'
    });
  }

  logPasswordChange(req, userId, details = {}) {
    const requestInfo = this.extractRequestInfo(req);
    
    this.logger.info('Password changed', {
      event: 'PASSWORD_CHANGE',
      ...requestInfo,
      userId,
      details: {
        method: details.method, // 'user_initiated', 'admin_reset', etc.
        strength: details.strength,
        ...details
      }
    });
  }

  logAccountLockout(identifier, details = {}) {
    this.logger.warn('Account locked out', {
      event: 'ACCOUNT_LOCKOUT',
      identifier,
      timestamp: new Date().toISOString(),
      details: {
        attempts: details.attempts,
        lockoutDuration: details.lockoutDuration,
        reason: details.reason,
        ...details
      }
    });
  }

  logRateLimitExceeded(req, details = {}) {
    const requestInfo = this.extractRequestInfo(req);
    
    this.logger.warn('Rate limit exceeded', {
      event: 'RATE_LIMIT_EXCEEDED',
      ...requestInfo,
      details: {
        limit: details.limit,
        windowMs: details.windowMs,
        ...details
      }
    });
  }

  logTokenRefresh(req, userId, details = {}) {
    const requestInfo = this.extractRequestInfo(req);
    
    this.logger.info('Token refreshed', {
      event: 'TOKEN_REFRESH',
      ...requestInfo,
      userId,
      details
    });
  }

  logTokenRevocation(req, tokenId, userId, details = {}) {
    const requestInfo = this.extractRequestInfo(req);
    
    this.logger.warn('Token revoked', {
      event: 'TOKEN_REVOCATION',
      ...requestInfo,
      tokenId,
      userId,
      details: {
        reason: details.reason,
        ...details
      }
    });
  }

  logConfigurationChange(userId, setting, oldValue, newValue, details = {}) {
    this.logger.warn('Configuration changed', {
      event: 'CONFIGURATION_CHANGE',
      userId,
      timestamp: new Date().toISOString(),
      details: {
        setting,
        oldValue: oldValue ? '[REDACTED]' : null,
        newValue: newValue ? '[REDACTED]' : null,
        ...details
      }
    });
  }

  // Middleware do automatycznego logowania żądań
  requestLogger() {
    return (req, res, next) => {
      const start = Date.now();
      
      // Log po zakończeniu odpowiedzi
      res.on('finish', () => {
        const duration = Date.now() - start;
        const requestInfo = this.extractRequestInfo(req);
        
        // Log tylko istotne żądania (nie assets, health checks, etc.)
        if (!req.url.includes('/health') && !req.url.includes('/favicon')) {
          this.logger.info('HTTP Request', {
            event: 'HTTP_REQUEST',
            ...requestInfo,
            statusCode: res.statusCode,
            duration,
            contentLength: res.get('content-length') || 0
          });
        }
      });
      
      next();
    };
  }

  // Middleware do logowania błędów
  errorLogger() {
    return (error, req, res, next) => {
      const requestInfo = this.extractRequestInfo(req);
      
      this.logger.error('Application error', {
        event: 'APPLICATION_ERROR',
        ...requestInfo,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      });
      
      next(error);
    };
  }
}

module.exports = new SecurityLogger();

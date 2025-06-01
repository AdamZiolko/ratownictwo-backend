/**
 * Request logging middleware for debugging JSON parsing issues
 */
const requestLogger = (req, res, next) => {
  // Only log API requests with JSON content
  if (req.path.startsWith('/api') && req.is('application/json')) {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      contentType: req.get('Content-Type'),
      contentLength: req.get('Content-Length'),
      userAgent: req.get('User-Agent'),
      origin: req.get('Origin'),
      referer: req.get('Referer'),
      ip: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString()
    };
    
    console.log('📥 Incoming JSON Request:', logData);
    
    // Log first part of raw body if available
    if (req.rawBody) {
      console.log('📄 Raw Body Preview:', req.rawBody.substring(0, 200));
    }
    
    // Log if this looks like a problematic request
    if (req.rawBody && (req.rawBody.includes('\\"') || req.rawBody.startsWith('"{') || req.rawBody.includes('\\{'))) {
      console.warn('⚠️ Potentially malformed JSON detected:', {
        hasEscapedQuotes: req.rawBody.includes('\\"'),
        startsWithQuotedBrace: req.rawBody.startsWith('"{'),
        hasEscapedBraces: req.rawBody.includes('\\{'),
        preview: req.rawBody.substring(0, 100)
      });
    }
  }
  
  next();
};

module.exports = requestLogger;

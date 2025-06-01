/**
 * Middleware to fix common JSON formatting issues before parsing
 * This middleware only processes the request if express.json() hasn't already parsed it
 */
const jsonFixer = (req, res, next) => {
  // Only process if it's a JSON request and body hasn't been parsed yet
  if (req.is('application/json') && req.method !== 'GET' && req.body === undefined) {
    let body = '';
    
    // Store the original req.on handlers to avoid conflicts
    const originalReq = req;
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        // Store original body for debugging
        req.originalRawBody = body;
        
        // Common fixes for malformed JSON
        let fixedBody = body;
        let wasFixed = false;
        
        // Fix 1: Remove excessive backslash escaping
        if (fixedBody.includes('\\"')) {
          fixedBody = fixedBody.replace(/\\"/g, '"');
          wasFixed = true;
          console.log('🔧 Fixed escaped quotes in JSON');
        }
        
        // Fix 2: Handle double-encoded JSON (JSON string within a JSON string)
        if (fixedBody.startsWith('"') && fixedBody.endsWith('"')) {
          try {
            // Try to parse as a JSON string first
            const unescaped = JSON.parse(fixedBody);
            if (typeof unescaped === 'string') {
              fixedBody = unescaped;
              wasFixed = true;
              console.log('🔧 Fixed double-encoded JSON');
            }
          } catch (e) {
            // If that fails, just remove the outer quotes
            fixedBody = fixedBody.slice(1, -1);
            wasFixed = true;
            console.log('🔧 Removed outer quotes from JSON');
          }
        }
        
        // Fix 3: Handle backslash-escaped entire JSON
        if (fixedBody.includes('\\{') || fixedBody.includes('\\}')) {
          fixedBody = fixedBody.replace(/\\([{}])/g, '$1');
          wasFixed = true;
          console.log('🔧 Fixed escaped braces in JSON');
        }
        
        // Try to parse the fixed JSON to validate it
        try {
          const parsed = JSON.parse(fixedBody);
          
          if (wasFixed) {
            console.log('✅ Successfully fixed malformed JSON:', {
              original: body.substring(0, 100),
              fixed: fixedBody.substring(0, 100),
              url: req.originalUrl
            });
            
            // Create a new readable stream with the fixed content
            const Readable = require('stream').Readable;
            const readable = new Readable();
            readable.push(fixedBody);
            readable.push(null);
            
            // Replace the request with our fixed stream
            Object.setPrototypeOf(readable, req);
            Object.assign(readable, req);
            readable.body = undefined; // Let express.json() parse it
            
            return next();
          }
          
        } catch (parseError) {
          console.error('❌ Could not fix malformed JSON:', {
            original: body.substring(0, 100),
            fixed: fixedBody.substring(0, 100),
            error: parseError.message,
            url: req.originalUrl
          });
        }
        
        next();
        
      } catch (error) {
        console.error('❌ Error in JSON fixer middleware:', error);
        next();
      }
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error in JSON fixer:', error);
      next(error);
    });
    
  } else {
    next();
  }
};

module.exports = jsonFixer;

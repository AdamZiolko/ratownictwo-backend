/**
 * Path Validation Middleware
 * Zapobiega atakom path traversal i waliduje nazwy plików
 */
const path = require('path');

/**
 * Middleware do walidacji nazw plików i zapobiegania path traversal
 */
const validateFilePath = (req, res, next) => {
  // Sprawdź wszystkie parametry URL zawierające potencjalne nazwy plików
  const fileParams = ['filename', 'file', 'path'];
  
  for (const param of fileParams) {
    if (req.params[param]) {
      const filename = req.params[param];
      
      // Sprawdź czy zawiera znaki path traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ 
          error: 'Invalid filename: path traversal detected',
          code: 'PATH_TRAVERSAL_DETECTED'
        });
      }
      
      // Sanityzuj nazwę pliku
      const sanitizedFilename = path.basename(filename);
      
      // Sprawdź czy sanityzacja zmieniła nazwę (oznacza potencjalny atak)
      if (filename !== sanitizedFilename) {
        return res.status(400).json({ 
          error: 'Invalid filename: contains path separators',
          code: 'INVALID_PATH_CHARACTERS'
        });
      }
      
      // Sprawdź czy nazwa pliku nie jest pusta po sanityzacji
      if (!sanitizedFilename || sanitizedFilename.trim() === '') {
        return res.status(400).json({ 
          error: 'Invalid filename: empty or invalid',
          code: 'EMPTY_FILENAME'
        });
      }
      
      // Zapisz zsanityzowaną nazwę
      req.params[param] = sanitizedFilename;
    }
  }
  
  // Sprawdź body dla nazw plików
  if (req.body && req.body.filename) {
    const filename = req.body.filename;
    
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ 
        error: 'Invalid filename in body: path traversal detected',
        code: 'PATH_TRAVERSAL_DETECTED'
      });
    }
    
    req.body.filename = path.basename(filename);
  }
  
  next();
};

/**
 * Waliduje czy plik znajduje się w dozwolonym katalogu
 */
const validateFileLocation = (allowedDir) => {
  return (req, res, next) => {
    if (req.file && req.file.path) {
      const resolvedPath = path.resolve(req.file.path);
      const resolvedAllowedDir = path.resolve(allowedDir);
      
      // Sprawdź czy plik jest w dozwolonym katalogu
      if (!resolvedPath.startsWith(resolvedAllowedDir)) {
        return res.status(400).json({ 
          error: 'File location outside allowed directory',
          code: 'INVALID_FILE_LOCATION'
        });
      }
    }
    
    next();
  };
};

/**
 * Waliduje rozszerzenia plików
 */
const validateFileExtension = (allowedExtensions) => {
  return (req, res, next) => {
    const filename = req.params.filename || req.body.filename || (req.file && req.file.originalname);
    
    if (filename) {
      const ext = path.extname(filename).toLowerCase();
      
      if (!allowedExtensions.includes(ext)) {
        return res.status(400).json({ 
          error: `File type not allowed. Allowed types: ${allowedExtensions.join(', ')}`,
          code: 'INVALID_FILE_TYPE'
        });
      }
    }
    
    next();
  };
};

/**
 * Bezpieczna funkcja do konstruowania ścieżek plików
 */
const safePath = (baseDir, filename) => {
  const sanitizedFilename = path.basename(filename);
  return path.join(baseDir, sanitizedFilename);
};

module.exports = {
  validateFilePath,
  validateFileLocation,
  validateFileExtension,
  safePath
};

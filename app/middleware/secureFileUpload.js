const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;
const { promisify } = require('util');

class SecureFileUpload {
  constructor() {
    this.allowedMimeTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/wave'
    ];
      this.allowedExtensions = ['.mp3', '.wav', '.mpeg'];
    this.maxFileSize = 25 * 1024 * 1024; // 25MB
    this.uploadDir = path.join(__dirname, '../../uploads');
    this.tempDir = path.join(__dirname, '../../temp');
    
    // Utwórz katalogi jeśli nie istnieją
    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Błąd przy tworzeniu katalogów:', error);
    }
  }

  getMulterConfig() {
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          await fs.mkdir(this.tempDir, { recursive: true });
          cb(null, this.tempDir);
        } catch (error) {
          cb(error);
        }
      },
      filename: (req, file, cb) => {
        // Generuj bezpieczną nazwę pliku
        const uniqueId = crypto.randomBytes(16).toString('hex');
        const timestamp = Date.now();
        const ext = path.extname(file.originalname).toLowerCase();
        const filename = `${timestamp}_${uniqueId}${ext}`;
        cb(null, filename);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: this.maxFileSize,
        files: 1
      },
      fileFilter: (req, file, cb) => {
        this.validateFile(file, cb);
      }
    });
  }

  validateFile(file, callback) {
    const errors = [];

    // Walidacja typu MIME
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      errors.push('Nieprawidłowy typ pliku. Dozwolone są tylko pliki audio.');
    }

    // Walidacja rozszerzenia
    const ext = path.extname(file.originalname).toLowerCase();
    if (!this.allowedExtensions.includes(ext)) {
      errors.push('Nieprawidłowe rozszerzenie pliku.');
    }

    // Walidacja nazwy pliku (zabezpieczenie przed path traversal)
    if (file.originalname.includes('..') || 
        file.originalname.includes('/') || 
        file.originalname.includes('\\') ||
        file.originalname.includes('\0')) {
      errors.push('Nieprawidłowa nazwa pliku.');
    }

    // Sprawdź długość nazwy pliku
    if (file.originalname.length > 255) {
      errors.push('Nazwa pliku jest zbyt długa.');
    }

    // Sprawdź czy nazwa pliku zawiera tylko dozwolone znaki
    if (!/^[a-zA-Z0-9._\-\s]+$/.test(file.originalname)) {
      errors.push('Nazwa pliku zawiera niedozwolone znaki.');
    }

    if (errors.length > 0) {
      return callback(new Error(errors.join(' ')));
    }

    callback(null, true);
  }

  async scanFileHeader(filePath) {
    try {
      // Sprawdź nagłówek pliku aby zweryfikować rzeczywisty typ
      const buffer = Buffer.alloc(12);
      const fileHandle = await fs.open(filePath, 'r');
      await fileHandle.read(buffer, 0, 12, 0);
      await fileHandle.close();

      // Sprawdź sygnatury plików audio
      const mp3Signature = buffer.slice(0, 3);
      const wavSignature = buffer.slice(0, 4);
      const riffSignature = buffer.slice(8, 12);

      // MP3 - ID3v2 lub Frame sync
      if (mp3Signature.toString() === 'ID3' || 
          (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0)) {
        return 'audio/mpeg';
      }

      // WAV - RIFF header
      if (wavSignature.toString() === 'RIFF' && 
          riffSignature.toString() === 'WAVE') {
        return 'audio/wav';
      }

      throw new Error('Nierozpoznany format pliku audio');
    } catch (error) {
      throw new Error('Błąd walidacji pliku: ' + error.message);
    }
  }

  async moveToSecureStorage(tempPath, originalName) {
    try {
      // Wygeneruj bezpieczną nazwę pliku
      const ext = path.extname(originalName).toLowerCase();
      const timestamp = Date.now();
      const randomId = crypto.randomBytes(16).toString('hex');
      const finalFilename = `${timestamp}_${randomId}${ext}`;
      const finalPath = path.join(this.uploadDir, finalFilename);

      // Przenieś plik z temp do uploads
      await fs.rename(tempPath, finalPath);

      return {
        filename: finalFilename,
        path: finalPath,
        originalName: originalName
      };
    } catch (error) {
      // Usuń plik tymczasowy w przypadku błędu
      try {
        await fs.unlink(tempPath);
      } catch (unlinkError) {
        console.error('Błąd przy usuwaniu pliku tymczasowego:', unlinkError);
      }
      throw error;
    }
  }

  async processUpload(req, res, next) {
    try {
      const upload = this.getMulterConfig().single('audioFile');
      const uploadAsync = promisify(upload);

      await uploadAsync(req, res);

      if (!req.file) {
        return res.status(400).json({ 
          error: 'No file uploaded',
          message: 'Nie przesłano pliku' 
        });
      }

      // Walidacja nagłówka pliku
      try {
        const detectedType = await this.scanFileHeader(req.file.path);
        console.log(`Wykryty typ pliku: ${detectedType}`);
      } catch (error) {
        // Usuń nieprawidłowy plik
        await fs.unlink(req.file.path);
        return res.status(400).json({
          error: 'Invalid file format',
          message: 'Nieprawidłowy format pliku: ' + error.message
        });
      }

      // Przenieś do bezpiecznego storage
      try {
        const fileInfo = await this.moveToSecureStorage(
          req.file.path, 
          req.file.originalname
        );
        
        req.file.secureFilename = fileInfo.filename;
        req.file.securePath = fileInfo.path;
        
        next();
      } catch (error) {
        return res.status(500).json({
          error: 'File processing failed',
          message: 'Błąd przetwarzania pliku: ' + error.message
        });
      }

    } catch (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'File too large',
            message: `Plik jest zbyt duży. Maksymalny rozmiar: ${this.maxFileSize / 1024 / 1024}MB`
          });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            error: 'Unexpected field',
            message: 'Nieoczekiwane pole pliku'
          });
        }
      }

      return res.status(500).json({ 
        error: 'Upload processing failed',
        message: 'Błąd przetwarzania przesyłania: ' + error.message
      });
    }
  }

  // Middleware do czyszczenia starych plików tymczasowych
  async cleanupTempFiles() {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 godziny

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          console.log(`Usunięto stary plik tymczasowy: ${file}`);
        }
      }
    } catch (error) {
      console.error('Błąd przy czyszczeniu plików tymczasowych:', error);
    }
  }
}

module.exports = new SecureFileUpload();

const { body, validationResult } = require('express-validator');
const xss = require('xss');

// Middleware do sanityzacji danych wejściowych
const sanitizeInput = (req, res, next) => {
  // Sanityzacja wszystkich stringów w body
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key]);
      }
    }
  }
  
  // Sanityzacja query params
  if (req.query && typeof req.query === 'object') {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = xss(req.query[key]);
      }
    }
  }
  
  next();
};

// Walidacja silnego hasła
const passwordValidation = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Hasło musi mieć co najmniej 8 znaków')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Hasło musi zawierać: małą literę, wielką literę, cyfrę i znak specjalny (@$!%*?&)')
];

// Walidacja nazwy użytkownika
const usernameValidation = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Nazwa użytkownika musi mieć 3-30 znaków')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Nazwa użytkownika może zawierać tylko litery, cyfry, _ i -')
];

// Walidacja emaila
const emailValidation = [
  body('email')
    .isEmail()
    .withMessage('Nieprawidłowy format adresu email')
    .normalizeEmail()
];

// Walidacja logowania
const loginValidation = [
  body('password')
    .notEmpty()
    .withMessage('Hasło jest wymagane'),
  body('username')
    .optional()
    .isLength({ min: 3 })
    .withMessage('Nazwa użytkownika musi mieć co najmniej 3 znaki'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Nieprawidłowy format adresu email')
];

// Walidacja rejestracji
const registrationValidation = [
  ...usernameValidation,
  ...emailValidation,
  ...passwordValidation
];

// Middleware do obsługi błędów walidacji
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Błędy walidacji',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Walidacja plików audio
const audioFileValidation = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Plik audio jest wymagany'
    });
  }

  // Sprawdź MIME type
  const allowedMimeTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/mp4',
    'audio/aac'
  ];

  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: 'Nieprawidłowy typ pliku. Dozwolone formaty: MP3, WAV, OGG, MP4, AAC'
    });
  }

  // Sprawdź rozmiar (maksymalnie 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      message: 'Plik jest zbyt duży. Maksymalny rozmiar: 10MB'
    });
  }

  next();
};

module.exports = {
  passwordValidation,
  usernameValidation,
  emailValidation,
  loginValidation,
  registrationValidation,
  handleValidationErrors,
  audioFileValidation,
  sanitizeInput
};

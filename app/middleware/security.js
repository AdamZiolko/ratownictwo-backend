const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// Konfiguracja nagłówków bezpieczeństwa
const securityHeaders = helmet({
  // Enhanced Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      objectSrc: ["'none'"], // Blokuj Flash i inne pluginy
      mediaSrc: ["'self'"], // Tylko z własnego źródła
      frameSrc: ["'none'"], // Blokuj osadzanie w ramkach
      upgradeInsecureRequests: process.env.ENFORCE_HTTPS === 'true' ? [] : null
    }
  },
  // Zapobiega clickjacking
  frameguard: { action: 'deny' },
  // Zapobiega MIME type sniffing
  noSniff: true,  // Wymusza HTTPS w produkcji (kontrolowane przez ENFORCE_HTTPS)
  hsts: process.env.ENFORCE_HTTPS === 'true' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false,
  // Dodatkowe nagłówki bezpieczeństwa
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginEmbedderPolicy: false, // Wyłącz jeśli powoduje problemy
  crossOriginResourcePolicy: { policy: "same-site" }
});

// Slow down dla wielokrotnych żądań
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minut
  delayAfter: 10, // Zezwól na 10 żądań na okno bez opóźnienia
  delayMs: () => 500, // Dodaj 500ms opóźnienia po przekroczeniu delayAfter
  validate: { delayMs: false } // Wyłącz ostrzeżenie
});

// Rate limiting dla logowania (bardziej restrykcyjny)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: 5, // maksymalnie 5 prób logowania na IP
  message: {
    error: 'Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Opóźnienie po nieudanej próbie
  skipSuccessfulRequests: true
});

// Rate limiting dla rejestracji (mniej restrykcyjny)
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minut
  max: 10, // maksymalnie 10 prób rejestracji na godzinę na IP
  message: {
    error: 'Zbyt wiele prób rejestracji. Spróbuj ponownie za godzinę.',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Deprecated: zachowane dla kompatybilności wstecznej
const authLimiter = loginLimiter;

// Rate limiting dla API (ogólny)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: 100, // maksymalnie 100 żądań na IP
  message: {
    error: 'Zbyt wiele żądań. Spróbuj ponownie za 15 minut.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting dla WebSocket (ograniczenie połączeń)
const socketLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuta
  max: 20, // maksymalnie 20 eventów na minutę
  message: {
    error: 'Zbyt wiele eventów WebSocket. Spróbuj ponownie za minutę.'
  }
});

// Rate limiting dla przesyłania plików
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 godzina
  max: 10, // maksymalnie 10 uploadów na godzinę
  message: {
    error: 'Zbyt wiele przesłanych plików. Spróbuj ponownie za godzinę.'
  }
});

// Konfiguracja CORS z ograniczonymi domenami
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : ['http://localhost:3000', 'http://localhost:8081'];
    
    // Pozwól na brak origin (mobilne aplikacje, Postman, itp.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`🚫 Odrzucono żądanie CORS z domeny: ${origin}`);
      callback(new Error('Nie dozwolone przez CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with'],
  optionsSuccessStatus: 200
};

module.exports = {
  securityHeaders,
  speedLimiter,
  authLimiter,
  loginLimiter,
  registrationLimiter,
  apiLimiter,
  socketLimiter,
  uploadLimiter,
  corsOptions
};

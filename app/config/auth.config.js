require('dotenv').config();
const secretManager = require('./secrets');

// Sprawdź czy są ustawione zmienne środowiskowe
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  OSTRZEŻENIE: JWT_SECRET nie jest ustawiony w zmiennych środowiskowych!');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET musi być ustawiony w produkcji!');
  }
}

if (!process.env.JWT_REFRESH_SECRET) {
  console.warn('⚠️  OSTRZEŻENIE: JWT_REFRESH_SECRET nie jest ustawiony w zmiennych środowiskowych!');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_REFRESH_SECRET musi być ustawiony w produkcji!');
  }
}

module.exports = {
  secret: secretManager.getSecret('JWT_SECRET'),
  jwtExpiration: parseInt(process.env.JWT_EXPIRATION) || 3600,           // 1 godzina (bezpieczniejsze)
  jwtRefreshExpiration: parseInt(process.env.JWT_REFRESH_EXPIRATION) || 86400,   // 24 godziny
  refreshTokenSecret: secretManager.getSecret('JWT_REFRESH_SECRET'),
  algorithm: 'RS256', // Użyj RSA zamiast HMAC
  issuer: 'ratownictwo-app',
  audience: 'ratownictwo-users'
};
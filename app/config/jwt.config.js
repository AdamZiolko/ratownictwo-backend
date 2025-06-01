const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class JWTManager {  constructor() {
    this.algorithm = 'RS256';
    this.issuer = 'ratownictwo-app';
    this.audience = 'ratownictwo-users';
    this.fallbackAlgorithm = 'HS256';
    
    try {
      this.privateKey = this.loadPrivateKey();
      this.publicKey = this.loadPublicKey();
      this.useRSA = true;
      console.log('✅ RSA keys loaded successfully');
    } catch (error) {
      console.warn('⚠️  Klucze RSA niedostępne, używam HMAC jako fallback');
      this.useRSA = false;
    }
    
    // Zawsze załaduj sekrety HMAC (potrzebne dla refresh tokenów)
    try {
      this.secret = require('./secrets').getSecret('JWT_SECRET');
      this.refreshSecret = require('./secrets').getSecret('JWT_REFRESH_SECRET');
      
      if (!this.secret || !this.refreshSecret) {
        throw new Error('JWT secrets not available');
      }
      
      console.log('✅ JWT secrets loaded successfully', {
        secretLength: this.secret.length,
        refreshSecretLength: this.refreshSecret.length
      });
    } catch (error) {
      console.error('❌ Failed to load JWT secrets:', error.message);
      throw error;
    }
  }

  loadPrivateKey() {
    const keyPath = path.join(__dirname, '../keys/private.pem');
    if (!fs.existsSync(keyPath)) {
      throw new Error('Klucz prywatny nie znaleziony. Wygeneruj klucze najpierw.');
    }
    return fs.readFileSync(keyPath, 'utf8');
  }

  loadPublicKey() {
    const keyPath = path.join(__dirname, '../keys/public.pem');
    if (!fs.existsSync(keyPath)) {
      throw new Error('Klucz publiczny nie znaleziony. Wygeneruj klucze najpierw.');
    }
    return fs.readFileSync(keyPath, 'utf8');
  }

  generateToken(payload, expiresIn = '1h') {
    const tokenPayload = {
      ...payload,
      iss: this.issuer,
      aud: this.audience,
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomBytes(16).toString('hex') // Unique token ID
    };

    const options = {
      expiresIn,
      algorithm: this.useRSA ? this.algorithm : this.fallbackAlgorithm
    };

    if (this.useRSA) {
      return jwt.sign(tokenPayload, this.privateKey, options);
    } else {
      return jwt.sign(tokenPayload, this.secret, options);
    }
  }

  verifyToken(token) {
    try {
      const options = {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: [this.useRSA ? this.algorithm : this.fallbackAlgorithm]
      };

      if (this.useRSA) {
        return jwt.verify(token, this.publicKey, options);
      } else {
        return jwt.verify(token, this.secret, options);
      }
    } catch (error) {
      throw new Error('Token verification failed: ' + error.message);
    }
  }

  generateRefreshToken(userId) {
    const payload = {
      userId,
      type: 'refresh',
      iss: this.issuer,
      aud: this.audience,
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomBytes(16).toString('hex')
    };

    const options = {
      expiresIn: '7d',
      algorithm: this.fallbackAlgorithm // Always use HMAC for refresh tokens
    };

    return jwt.sign(payload, this.refreshSecret, options);
  }
  verifyRefreshToken(token) {
    try {
      const options = {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: [this.fallbackAlgorithm]
      };

      // Upewnij się, że mamy secret dla refresh tokenów
      if (!this.refreshSecret) {
        console.error('Refresh secret not available:', {
          useRSA: this.useRSA,
          hasSecret: !!this.secret,
          hasRefreshSecret: !!this.refreshSecret
        });
        throw new Error('Refresh secret not configured');
      }

      const decoded = jwt.verify(token, this.refreshSecret, options);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      console.error('Refresh token verification error:', {
        error: error.message,
        hasRefreshSecret: !!this.refreshSecret,
        refreshSecretLength: this.refreshSecret ? this.refreshSecret.length : 0
      });
      throw new Error('Refresh token verification failed: ' + error.message);
    }
  }

  // Blacklist tokenów (do implementacji w bazie danych)
  async blacklistToken(token) {
    try {
      const decoded = this.verifyToken(token);
      // TODO: Zapisz jti w blacklist w bazie danych
      console.log(`Token ${decoded.jti} dodany do blacklisty`);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Sprawdź czy token jest na blackliście
  async isTokenBlacklisted(token) {
    try {
      const decoded = this.verifyToken(token);
      // TODO: Sprawdź jti w blacklist w bazie danych
      return false; // Placeholder
    } catch (error) {
      return true;
    }
  }

  // Dekoduj token bez weryfikacji (do debugowania)
  decodeToken(token) {
    return jwt.decode(token, { complete: true });
  }
}

module.exports = new JWTManager();

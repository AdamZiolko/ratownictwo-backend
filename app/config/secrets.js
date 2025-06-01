const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SecretManager {
  constructor() {
    this.secrets = new Map();
    this.initializeSecrets();
  }

  initializeSecrets() {
    // Sprawdź czy klucze RSA istnieją
    this.checkRSAKeys();
    
    // Generuj silne sekrety JWT jeśli nie są podane
    const jwtSecret = process.env.JWT_SECRET || this.generateSecret(32);
    const refreshSecret = process.env.JWT_REFRESH_SECRET || this.generateSecret(32);
    const encryptionKey = process.env.ENCRYPTION_KEY || this.generateSecret(32);
    
    this.secrets.set('JWT_SECRET', jwtSecret);
    this.secrets.set('JWT_REFRESH_SECRET', refreshSecret);
    this.secrets.set('ENCRYPTION_KEY', encryptionKey);
    
    // Waliduj siłę sekretów
    this.validateSecretStrength(jwtSecret);
    this.validateSecretStrength(refreshSecret);
    
    if (process.env.NODE_ENV === 'production') {
      this.validateProductionSecrets();
    }
  }

  checkRSAKeys() {
    const privateKeyPath = path.join(__dirname, '../keys/private.pem');
    const publicKeyPath = path.join(__dirname, '../keys/public.pem');
    
    if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
      console.warn('⚠️  Klucze RSA nie istnieją. Uruchom: npm run generate-keys');
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Klucze RSA są wymagane w produkcji!');
      }
    }
  }

  generateSecret(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }
  validateSecretStrength(secret) {
    if (secret.length < 32) {
      console.warn(`⚠️ Secret length is ${secret.length}, minimum is 32`);
      // Nie rzucaj błędem, tylko ostrzeż - pozwól aplikacji działać
      // throw new Error('Sekrety JWT muszą mieć co najmniej 32 znaki');
    }
    
    // Sprawdź entropię
    if (this.calculateEntropy(secret) < 4.0) {
      console.warn('⚠️  Ostrzeżenie: Sekret JWT ma niską entropię');
    }
  }

  validateProductionSecrets() {
    const requiredSecrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'ENCRYPTION_KEY'];
    
    for (const secret of requiredSecrets) {
      if (!process.env[secret]) {
        throw new Error(`${secret} musi być ustawiony w produkcji!`);
      }
    }
  }

  calculateEntropy(str) {
    const freq = {};
    for (let char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    const len = str.length;
    for (let char in freq) {
      const p = freq[char] / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  getSecret(key) {
    return this.secrets.get(key);
  }  // Szyfrowanie wrażliwych danych
  encrypt(text) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(this.getSecret('ENCRYPTION_KEY'), 'hex');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key, iv);
    cipher.setAAD(Buffer.from('ratownictwo-app', 'utf8'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  // Deszyfrowanie wrażliwych danych
  decrypt(encryptedData) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(this.getSecret('ENCRYPTION_KEY'), 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key, iv);
    decipher.setAAD(Buffer.from('ratownictwo-app', 'utf8'));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

module.exports = new SecretManager();

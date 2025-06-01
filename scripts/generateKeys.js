const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateRSAKeyPair() {
  console.log('Generowanie pary kluczy RSA dla podpisywania JWT...');
  
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  // Utwórz katalog kluczy
  const keysDir = path.join(__dirname, '../app/keys');
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  // Zapisz klucze do plików
  fs.writeFileSync(path.join(keysDir, 'private.pem'), privateKey);
  fs.writeFileSync(path.join(keysDir, 'public.pem'), publicKey);

  // Ustaw odpowiednie uprawnienia (systemy Unix)
  if (process.platform !== 'win32') {
    fs.chmodSync(path.join(keysDir, 'private.pem'), 0o600);
    fs.chmodSync(path.join(keysDir, 'public.pem'), 0o644);
  }

  console.log('Klucze wygenerowane pomyślnie!');
  console.log('Klucz prywatny: app/keys/private.pem');
  console.log('Klucz publiczny: app/keys/public.pem');
  
  // Dodaj do .gitignore
  const gitignorePath = path.join(__dirname, '../.gitignore');
  const gitignoreContent = fs.existsSync(gitignorePath) ? 
    fs.readFileSync(gitignorePath, 'utf8') : '';
  
  if (!gitignoreContent.includes('app/keys/')) {
    fs.appendFileSync(gitignorePath, '\n# RSA Keys\napp/keys/\n');
    console.log('Dodano katalog kluczy do .gitignore');
  }
}

function generateSecureSecrets() {
  console.log('Generowanie bezpiecznych sekretów...');
  
  const jwtSecret = crypto.randomBytes(32).toString('hex');
  const refreshSecret = crypto.randomBytes(32).toString('hex');
  const encryptionKey = crypto.randomBytes(32).toString('hex');
  
  const envExample = `# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ratownictwo_db
DB_USERNAME=your_username
DB_PASSWORD=your_secure_password

# JWT Configuration (Wygenerowane automatycznie)
JWT_SECRET=${jwtSecret}
JWT_REFRESH_SECRET=${refreshSecret}
JWT_EXPIRATION=3600
JWT_REFRESH_EXPIRATION=86400

# Encryption Key (dla szyfrowania wrażliwych danych)
ENCRYPTION_KEY=${encryptionKey}

# Server Configuration
PORT=3000
NODE_ENV=development

# File Upload Configuration
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=audio/mpeg,audio/wav,audio/mp3

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security Headers
CORS_ORIGIN=http://localhost:19006
`;

  fs.writeFileSync(path.join(__dirname, '../.env.example'), envExample);
  console.log('Plik .env.example został utworzony z bezpiecznymi sekretami');
  console.log('UWAGA: Skopiuj .env.example do .env i dostosuj wartości do swojego środowiska');
}

if (require.main === module) {
  generateRSAKeyPair();
  generateSecureSecrets();
}

module.exports = { generateRSAKeyPair, generateSecureSecrets };

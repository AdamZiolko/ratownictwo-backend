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



if (require.main === module) {
  generateRSAKeyPair();
}

module.exports = { generateRSAKeyPair };

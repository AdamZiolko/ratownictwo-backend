#!/usr/bin/env node

/**
 * Security Test Script
 * Automatyczne testy bezpieczeństwa aplikacji ratownictwo - ZMODYFIKOWANE
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔒 SECURITY TEST SUITE - Aplikacja Ratownictwo');
console.log('================================================\n');

const tests = [
  {
    name: '1. Sprawdzenie podatności dependencies',
    test: testVulnerabilities,
    critical: true
  },
  {
    name: '2. Weryfikacja konfiguracji HTTPS',
    test: testHttpsConfig,
    critical: true
  },
  {
    name: '3. Test funkcjonalności token blacklist',
    test: testTokenBlacklist,
    critical: false
  },
  {
    name: '4. Sprawdzenie path traversal protection',
    test: testPathTraversal,
    critical: false
  },
  {
    name: '5. Weryfikacja CSP headers',
    test: testCSPHeaders,
    critical: false
  }
];

let passedTests = 0;
let failedTests = 0;
let criticalFailures = 0;

console.log('🔍 Security Implementation Tests');
console.log('================================\n');

let passed = 0;
let failed = 0;

function test(description, condition) {
  if (condition) {
    console.log(`✅ ${description}`);
    passed++;
  } else {
    console.log(`❌ ${description}`);
    failed++;
  }
}

// Test 1: Check if security middleware files exist
test('SecretManager exists', fs.existsSync('./app/config/secrets.js'));
test('JWTManager exists', fs.existsSync('./app/config/jwt.config.js'));
test('AccountLockout middleware exists', fs.existsSync('./app/middleware/accountLockout.js'));
test('PasswordValidation middleware exists', fs.existsSync('./app/middleware/passwordValidation.js'));
test('SecureFileUpload middleware exists', fs.existsSync('./app/middleware/secureFileUpload.js'));
test('SecurityLogger exists', fs.existsSync('./app/middleware/securityLogger.js'));
test('ErrorHandler middleware exists', fs.existsSync('./app/middleware/errorHandler.js'));

// Test 2: Check if scripts exist
test('Key generation script exists', fs.existsSync('./scripts/generateKeys.js'));
test('Security setup script exists', fs.existsSync('./scripts/setupSecurity.js'));

// Test 3: Check package.json for security dependencies
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const requiredDeps = ['bcryptjs', 'jsonwebtoken', 'node-cache', 'validator', 'winston'];

requiredDeps.forEach(dep => {
  test(`Dependency ${dep} exists in package.json`, 
    packageJson.dependencies && packageJson.dependencies[dep]);
});

// Test 4: Check if environment example is updated
if (fs.existsSync('./.env.example')) {
  const envExample = fs.readFileSync('./.env.example', 'utf8');
  test('Environment example includes JWT_ALGORITHM', envExample.includes('JWT_ALGORITHM'));
  test('Environment example includes security config', envExample.includes('ACCOUNT_LOCKOUT_ATTEMPTS'));
  test('Environment example includes password config', envExample.includes('PASSWORD_MIN_LENGTH'));
  test('Environment example includes file upload config', envExample.includes('MAX_FILE_SIZE'));
}

// Test 5: Check if auth controller is updated
if (fs.existsSync('./app/controllers/auth.controller.js')) {
  const authController = fs.readFileSync('./app/controllers/auth.controller.js', 'utf8');
  test('Auth controller uses new JWT system', authController.includes('jwtManager'));
  test('Auth controller uses account lockout', authController.includes('accountLockout'));
  test('Auth controller uses security logging', authController.includes('securityLogger'));
}

// Test 6: Check if auth routes are updated
if (fs.existsSync('./app/routes/auth.routes.js')) {
  const authRoutes = fs.readFileSync('./app/routes/auth.routes.js', 'utf8');
  test('Auth routes use account lockout middleware', authRoutes.includes('accountLockout'));
  test('Auth routes use password validation', authRoutes.includes('passwordValidation'));
}

// Test 7: Check if audio routes are updated for secure upload
if (fs.existsSync('./app/routes/audio.routes.js')) {
  const audioRoutes = fs.readFileSync('./app/routes/audio.routes.js', 'utf8');
  test('Audio routes use secure file upload', audioRoutes.includes('secureFileUpload'));
}

// Test 8: Check if server.js includes error handling
if (fs.existsSync('./server.js')) {
  const serverJs = fs.readFileSync('./server.js', 'utf8');
  test('Server includes error handling middleware', serverJs.includes('globalErrorHandler'));
  test('Server includes security logging', serverJs.includes('securityLogger'));
}

// Results
console.log('\n📊 Test Results');
console.log('================');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

if (failed === 0) {
  console.log('\n🎉 All security implementation tests passed!');
  console.log('The security features appear to be properly implemented.');
  console.log('\nNext steps:');
  console.log('1. Run: npm run setup-security');
  console.log('2. Update your .env file');
  console.log('3. Test the application');
} else {
  console.log('\n⚠️  Some tests failed. Please review the implementation.');
}

async function runSecurityTests() {
  console.log('🔍 Uruchamianie testów bezpieczeństwa...\n');
  
  for (const test of tests) {
    try {
      console.log(`${test.name}...`);
      const result = await test.test();
      
      if (result.passed) {
        console.log(`✅ PASSED: ${result.message}\n`);
        passedTests++;
      } else {
        console.log(`❌ FAILED: ${result.message}\n`);
        failedTests++;
        if (test.critical) criticalFailures++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}\n`);
      failedTests++;
      if (test.critical) criticalFailures++;
    }
  }
  
  // Podsumowanie
  console.log('📊 PODSUMOWANIE TESTÓW BEZPIECZEŃSTWA');
  console.log('=====================================');
  console.log(`✅ Testy zakończone sukcesem: ${passedTests}`);
  console.log(`❌ Testy nieudane: ${failedTests}`);
  console.log(`🔴 Krytyczne niepowodzenia: ${criticalFailures}`);
  
  if (criticalFailures > 0) {
    console.log('\n🚨 UWAGA: Znaleziono krytyczne problemy bezpieczeństwa!');
    process.exit(1);
  } else if (failedTests > 0) {
    console.log('\n⚠️ Niektóre testy nie powiodły się. Sprawdź szczegóły powyżej.');
    process.exit(1);
  } else {
    console.log('\n🎉 Wszystkie testy bezpieczeństwa przeszły pomyślnie!');
    process.exit(0);
  }
}

function testVulnerabilities() {
  try {
    // Test aplikacji mobilnej
    process.chdir(path.join(__dirname, '../../ratownictwo-aplikacja'));
    const mobileAudit = execSync('npm audit --audit-level high', { encoding: 'utf8' });
    
    // Test backendu
    process.chdir(path.join(__dirname, '..'));
    const backendAudit = execSync('npm audit --audit-level high', { encoding: 'utf8' });
    
    return {
      passed: true,
      message: 'Brak podatności wysokiego/krytycznego ryzyka'
    };
  } catch (error) {
    return {
      passed: false,
      message: `Znaleziono podatności: ${error.message.slice(0, 200)}`
    };
  }
}

function testHttpsConfig() {
  try {
    const serverPath = path.join(__dirname, '../server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    
    if (serverContent.includes('NODE_ENV === \'production\'') && 
        serverContent.includes('x-forwarded-proto')) {
      return {
        passed: true,
        message: 'HTTPS enforcement jest prawidłowo skonfigurowane'
      };
    } else {
      return {
        passed: false,
        message: 'Brak konfiguracji HTTPS enforcement'
      };
    }
  } catch (error) {
    return {
      passed: false,
      message: `Błąd sprawdzania konfiguracji HTTPS: ${error.message}`
    };
  }
}

function testTokenBlacklist() {
  try {
    const blacklistPath = path.join(__dirname, '../app/utils/tokenBlacklist.js');
    const authPath = path.join(__dirname, '../app/middleware/authJwt.js');
    
    if (fs.existsSync(blacklistPath) && fs.existsSync(authPath)) {
      const authContent = fs.readFileSync(authPath, 'utf8');
      if (authContent.includes('tokenBlacklist.isTokenBlacklisted')) {
        return {
          passed: true,
          message: 'Token blacklist jest zaimplementowany i używany'
        };
      }
    }
    
    return {
      passed: false,
      message: 'Token blacklist nie jest w pełni zaimplementowany'
    };
  } catch (error) {
    return {
      passed: false,
      message: `Błąd sprawdzania token blacklist: ${error.message}`
    };
  }
}

function testPathTraversal() {
  try {
    const pathValidationPath = path.join(__dirname, '../app/middleware/pathValidation.js');
    
    if (fs.existsSync(pathValidationPath)) {
      const content = fs.readFileSync(pathValidationPath, 'utf8');
      if (content.includes('path.basename') && content.includes('..')) {
        return {
          passed: true,
          message: 'Path traversal protection jest zaimplementowane'
        };
      }
    }
    
    return {
      passed: false,
      message: 'Path traversal protection nie został znaleziony'
    };
  } catch (error) {
    return {
      passed: false,
      message: `Błąd sprawdzania path traversal: ${error.message}`
    };
  }
}

function testCSPHeaders() {
  try {
    const securityPath = path.join(__dirname, '../app/middleware/security.js');
    const content = fs.readFileSync(securityPath, 'utf8');
    
    if (content.includes('contentSecurityPolicy') && 
        content.includes('objectSrc') && 
        content.includes('frameSrc')) {
      return {
        passed: true,
        message: 'Enhanced CSP headers są skonfigurowane'
      };
    } else {
      return {
        passed: false,
        message: 'CSP headers wymagają poprawy'
      };
    }
  } catch (error) {
    return {
      passed: false,
      message: `Błąd sprawdzania CSP: ${error.message}`
    };
  }
}

// Uruchom nowe testy bezpieczeństwa
runSecurityTests();

console.log('\n🔍 LEGACY TESTS:');
console.log('================\n');

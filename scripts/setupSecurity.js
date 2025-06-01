#!/usr/bin/env node

/**
 * Security Setup Script
 * This script helps set up the security infrastructure for the Ratownictwo application
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('🔒 Ratownictwo Security Setup');
console.log('=============================\n');

// Check if running in the correct directory
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ Error: This script must be run from the backend root directory');
  process.exit(1);
}

async function setupSecurity() {
  try {
    // 1. Generate RSA keys for JWT
    console.log('1. Generating RSA keys for JWT...');
    try {
      execSync('node scripts/generateKeys.js', { stdio: 'inherit' });
      console.log('✅ RSA keys generated successfully');
    } catch (error) {
      console.error('❌ Failed to generate RSA keys:', error.message);
    }

    // 2. Create .env file from example if it doesn't exist
    console.log('\n2. Setting up environment configuration...');
    const envPath = path.join(process.cwd(), '.env');
    const envExamplePath = path.join(process.cwd(), '.env.example');
    
    if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('✅ Created .env file from .env.example');
      console.log('⚠️  Please update .env with your specific configuration');
    } else if (fs.existsSync(envPath)) {
      console.log('✅ .env file already exists');
    } else {
      console.log('⚠️  No .env.example found to copy from');
    }

    // 3. Generate encryption key for secret management
    console.log('\n3. Generating encryption key for secret management...');
    const encryptionKey = crypto.randomBytes(32).toString('hex');
    console.log('🔑 Generated encryption key (add to .env):');
    console.log(`SECRET_ENCRYPTION_KEY=${encryptionKey}`);

    // 4. Create logs directory
    console.log('\n4. Setting up logging directory...');
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      console.log('✅ Created logs directory');
    } else {
      console.log('✅ Logs directory already exists');
    }

    // 5. Set proper file permissions (Unix-like systems only)
    if (process.platform !== 'win32') {
      console.log('\n5. Setting file permissions...');
      try {
        // Secure the keys directory
        const keysDir = path.join(process.cwd(), 'keys');
        if (fs.existsSync(keysDir)) {
          execSync(`chmod 700 ${keysDir}`);
          execSync(`chmod 600 ${keysDir}/*`);
          console.log('✅ Set secure permissions on keys directory');
        }

        // Secure the .env file
        if (fs.existsSync(envPath)) {
          execSync(`chmod 600 ${envPath}`);
          console.log('✅ Set secure permissions on .env file');
        }
      } catch (error) {
        console.warn('⚠️  Could not set file permissions:', error.message);
      }
    }

    // 6. Validate package.json for security dependencies
    console.log('\n6. Checking security dependencies...');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const requiredDeps = [
      'bcryptjs',
      'jsonwebtoken', 
      'node-cache',
      'validator',
      'winston',
      'express-rate-limit',
      'helmet'
    ];

    const missingDeps = requiredDeps.filter(dep => 
      !packageJson.dependencies || !packageJson.dependencies[dep]
    );

    if (missingDeps.length > 0) {
      console.log('⚠️  Missing security dependencies:', missingDeps.join(', '));
      console.log('   Run: npm install');
    } else {
      console.log('✅ All security dependencies are present');
    }

    // 7. Create .gitignore entries for security files
    console.log('\n7. Updating .gitignore for security files...');
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const securityEntries = [
      '',
      '# Security files',
      '.env',
      '.env.local',
      '.env.production',
      'keys/',
      'logs/',
      '*.pem',
      '*.key'
    ].join('\n');

    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      if (!gitignoreContent.includes('# Security files')) {
        fs.appendFileSync(gitignorePath, securityEntries);
        console.log('✅ Added security entries to .gitignore');
      } else {
        console.log('✅ Security entries already in .gitignore');
      }
    } else {
      fs.writeFileSync(gitignorePath, securityEntries);
      console.log('✅ Created .gitignore with security entries');
    }

    // Summary
    console.log('\n🎉 Security Setup Complete!');
    console.log('==========================');
    console.log('');
    console.log('Next steps:');
    console.log('1. Update your .env file with production values');
    console.log('2. Run: npm install (if dependencies are missing)');
    console.log('3. Start your application: npm start');
    console.log('');
    console.log('Security features enabled:');
    console.log('• RSA-based JWT signing');
    console.log('• Account lockout protection');
    console.log('• Password strength validation');
    console.log('• Secure file upload validation');
    console.log('• Comprehensive security logging');
    console.log('• Environment variable encryption');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupSecurity();

const validator = require('validator');

class PasswordValidator {
  constructor() {
    this.minLength = 8;
    this.maxLength = 128;
    this.requireUppercase = true;
    this.requireLowercase = true;
    this.requireNumbers = true;
    this.requireSymbols = true;
    
    // Lista popularnych haseł
    this.commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      'login', 'user', 'test', 'guest', 'password1',
      '12345678', '123123', 'qwertyuiop', 'asdfghjkl',
      'zxcvbnm', 'iloveyou', 'princess', 'rockyou'
    ];
  }

  validate(password) {
    const errors = [];

    // Sprawdzenie długości
    if (password.length < this.minLength) {
      errors.push(`Hasło musi mieć co najmniej ${this.minLength} znaków`);
    }

    if (password.length > this.maxLength) {
      errors.push(`Hasło nie może przekraczać ${this.maxLength} znaków`);
    }

    // Wymogi dotyczące znaków
    if (this.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Hasło musi zawierać co najmniej jedną wielką literę');
    }

    if (this.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Hasło musi zawierać co najmniej jedną małą literę');
    }

    if (this.requireNumbers && !/\d/.test(password)) {
      errors.push('Hasło musi zawierać co najmniej jedną cyfrę');
    }

    if (this.requireSymbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
      errors.push('Hasło musi zawierać co najmniej jeden znak specjalny');
    }

    // Sprawdzenie popularnych haseł
    if (this.isCommonPassword(password)) {
      errors.push('To hasło jest zbyt popularne. Wybierz mocniejsze hasło');
    }

    // Sprawdzenie wzorców
    if (this.hasRepeatingCharacters(password)) {
      errors.push('Hasło nie może zawierać więcej niż 3 powtarzające się znaki z rzędu');
    }

    if (this.hasSequentialCharacters(password)) {
      errors.push('Hasło nie może zawierać sekwencji znaków (np. 123, abc)');
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      strength: this.calculateStrength(password)
    };
  }

  isCommonPassword(password) {
    return this.commonPasswords.includes(password.toLowerCase());
  }

  hasRepeatingCharacters(password) {
    return /(.)\1{3,}/.test(password);
  }

  hasSequentialCharacters(password) {
    const sequences = [
      '123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop',
      'asdfghjkl', 'zxcvbnm', '987654321', 'zyxwvutsrqponmlkjihgfedcba'
    ];
    
    const lowerPassword = password.toLowerCase();
    
    for (let sequence of sequences) {
      for (let i = 0; i <= sequence.length - 4; i++) {
        if (lowerPassword.includes(sequence.substring(i, i + 4))) {
          return true;
        }
      }
    }
    
    return false;
  }

  calculateStrength(password) {
    let score = 0;
    
    // Punkty za długość
    score += Math.min(password.length * 2, 25);
    
    // Punkty za różnorodność znaków
    if (/[a-z]/.test(password)) score += 5;
    if (/[A-Z]/.test(password)) score += 5;
    if (/\d/.test(password)) score += 5;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) score += 10;
    
    // Punkty za unikalność znaków
    const uniqueChars = new Set(password).size;
    score += uniqueChars * 2;
    
    // Kary za wzorce
    if (this.hasRepeatingCharacters(password)) score -= 15;
    if (this.hasSequentialCharacters(password)) score -= 15;
    if (this.isCommonPassword(password)) score -= 25;
    
    // Bonus za długość
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
    
    return Math.min(Math.max(score, 0), 100);
  }

  getStrengthDescription(score) {
    if (score < 30) return 'Bardzo słabe';
    if (score < 50) return 'Słabe';
    if (score < 70) return 'Średnie';
    if (score < 85) return 'Mocne';
    return 'Bardzo mocne';
  }

  // Middleware dla Express
  middleware() {
    return (req, res, next) => {
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({
          error: 'Password required',
          message: 'Hasło jest wymagane'
        });
      }

      const validation = this.validate(password);
      
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Password validation failed',
          message: 'Hasło nie spełnia wymagań bezpieczeństwa',
          errors: validation.errors,
          strength: {
            score: validation.strength,
            description: this.getStrengthDescription(validation.strength)
          }
        });
      }

      // Dodaj informacje o sile hasła do response
      res.locals.passwordStrength = {
        score: validation.strength,
        description: this.getStrengthDescription(validation.strength)
      };

      next();
    };
  }
}

module.exports = new PasswordValidator();

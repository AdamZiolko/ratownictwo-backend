const NodeCache = require('node-cache');

class AccountLockout {
  constructor() {
    // Używamy cache w pamięci, w produkcji lepiej użyć Redis
    this.cache = new NodeCache();
    this.MAX_ATTEMPTS = 5;
    this.LOCKOUT_DURATION = 30 * 60; // 30 minut w sekundach
    this.ATTEMPT_WINDOW = 15 * 60; // 15 minut w sekundach
  }

  async checkLockout(identifier) {
    const key = `lockout:${identifier}`;
    const attempts = this.cache.get(key);
    
    if (attempts && attempts.count >= this.MAX_ATTEMPTS) {
      const remainingTime = this.cache.getTtl(key);
      const minutesLeft = Math.ceil((remainingTime - Date.now()) / 60000);
      
      throw new Error(`Konto zablokowane. Spróbuj ponownie za ${minutesLeft} minut.`);
    }
    
    return true;
  }

  async recordFailedAttempt(identifier) {
    const key = `lockout:${identifier}`;
    const current = this.cache.get(key);
    
    if (current) {
      const newCount = current.count + 1;
      
      if (newCount >= this.MAX_ATTEMPTS) {
        // Zablokuj konto na dłuższy czas
        this.cache.set(key, { count: newCount, lockedAt: Date.now() }, this.LOCKOUT_DURATION);
      } else {
        // Zwiększ liczbę prób
        this.cache.set(key, { count: newCount }, this.ATTEMPT_WINDOW);
      }
    } else {
      // Pierwsza nieudana próba
      this.cache.set(key, { count: 1 }, this.ATTEMPT_WINDOW);
    }
    
    const attempts = this.cache.get(key);
    return {
      attempts: attempts.count,
      maxAttempts: this.MAX_ATTEMPTS,
      remainingAttempts: Math.max(0, this.MAX_ATTEMPTS - attempts.count)
    };
  }

  async clearFailedAttempts(identifier) {
    const key = `lockout:${identifier}`;
    this.cache.del(key);
  }

  async getAttemptInfo(identifier) {
    const key = `lockout:${identifier}`;
    const attempts = this.cache.get(key);
    
    if (!attempts) {
      return {
        attempts: 0,
        maxAttempts: this.MAX_ATTEMPTS,
        remainingAttempts: this.MAX_ATTEMPTS,
        isLocked: false
      };
    }
    
    const isLocked = attempts.count >= this.MAX_ATTEMPTS;
    let timeRemaining = 0;
    
    if (isLocked) {
      const ttl = this.cache.getTtl(key);
      timeRemaining = Math.max(0, Math.ceil((ttl - Date.now()) / 60000));
    }
    
    return {
      attempts: attempts.count,
      maxAttempts: this.MAX_ATTEMPTS,
      remainingAttempts: Math.max(0, this.MAX_ATTEMPTS - attempts.count),
      isLocked,
      timeRemainingMinutes: timeRemaining
    };
  }

  // Middleware do Express
  middleware() {
    return async (req, res, next) => {
      try {
        const identifier = req.ip || req.connection.remoteAddress;
        await this.checkLockout(identifier);
        next();
      } catch (error) {
        return res.status(429).json({
          error: 'Account locked',
          message: error.message
        });
      }
    };
  }
}

module.exports = new AccountLockout();

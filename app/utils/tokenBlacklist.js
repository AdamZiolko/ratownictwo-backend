/**
 * Token Blacklist Manager
 * Zarządza listą unieważnionych tokenów JWT
 */

class TokenBlacklist {
  constructor() {
    // In-memory storage for blacklisted tokens
    // W produkcji należy użyć Redis lub bazy danych
    this.blacklistedTokens = new Set();
    this.tokenExpirations = new Map();
    
    // Automatyczne czyszczenie wygasłych tokenów co godzinę
    setInterval(() => {
      this.cleanup();
    }, 3600000); // 1 hour
  }

  /**
   * Dodaje token do blacklisty
   * @param {string} token - Token JWT do unieważnienia
   * @param {number} expirationTime - Czas wygaśnięcia tokena (timestamp)
   */
  async addToken(token, expirationTime) {
    try {
      this.blacklistedTokens.add(token);
      this.tokenExpirations.set(token, expirationTime);
      
      console.log(`Token blacklisted: ${token.substring(0, 20)}...`);
      return true;
    } catch (error) {
      console.error('Error adding token to blacklist:', error);
      return false;
    }
  }

  /**
   * Sprawdza czy token jest na blackliście
   * @param {string} token - Token do sprawdzenia
   * @returns {boolean} True jeśli token jest unieważniony
   */
  async isTokenBlacklisted(token) {
    try {
      return this.blacklistedTokens.has(token);
    } catch (error) {
      console.error('Error checking token blacklist:', error);
      return false; // Fail safe - nie blokuj w przypadku błędu
    }
  }

  /**
   * Usuwa wygasłe tokeny z blacklisty
   */
  cleanup() {
    const now = Math.floor(Date.now() / 1000);
    let removedCount = 0;

    for (const [token, expiration] of this.tokenExpirations.entries()) {
      if (expiration < now) {
        this.blacklistedTokens.delete(token);
        this.tokenExpirations.delete(token);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} expired tokens from blacklist`);
    }
  }

  /**
   * Zwraca statystyki blacklisty
   */
  getStats() {
    return {
      activeTokens: this.blacklistedTokens.size,
      totalTokensTracked: this.tokenExpirations.size
    };
  }

  /**
   * Czyści całą blacklistę (użyj ostrożnie!)
   */
  clear() {
    this.blacklistedTokens.clear();
    this.tokenExpirations.clear();
    console.log('Token blacklist cleared');
  }
}

// Singleton instance
const tokenBlacklist = new TokenBlacklist();

module.exports = tokenBlacklist;

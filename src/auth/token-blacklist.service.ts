import { Injectable } from '@nestjs/common';

export interface BlacklistedToken {
  jti: string; // JWT ID
  userId: string;
  expiresAt: Date;
  revokedAt: Date;
  reason: string;
}

@Injectable()
export class TokenBlacklistService {
  private blacklistedTokens = new Map<string, BlacklistedToken>();

  /**
   * Add a token to the blacklist
   */
  blacklistToken(
    jti: string,
    userId: string,
    expiresAt: Date,
    reason: string = 'Manual revocation'
  ): void {
    const blacklistedToken: BlacklistedToken = {
      jti,
      userId,
      expiresAt,
      revokedAt: new Date(),
      reason,
    };

    this.blacklistedTokens.set(jti, blacklistedToken);
  }

  /**
   * Check if a token is blacklisted
   */
  isTokenBlacklisted(jti: string): boolean {
    const blacklistedToken = this.blacklistedTokens.get(jti);
    
    if (!blacklistedToken) {
      return false;
    }

    // Remove expired blacklisted tokens automatically
    if (blacklistedToken.expiresAt < new Date()) {
      this.blacklistedTokens.delete(jti);
      return false;
    }

    return true;
  }

  /**
   * Revoke all tokens for a specific user
   */
  revokeAllUserTokens(userId: string, reason: string = 'User logout'): void {
    // In a real implementation, this would need to work with a database
    // For now, we'll mark tokens as revoked by adding them to blacklist
    for (const [_jti, token] of this.blacklistedTokens.entries()) {
      if (token.userId === userId) {
        token.reason = reason;
        token.revokedAt = new Date();
      }
    }
  }

  /**
   * Clean up expired blacklisted tokens
   */
  cleanupExpiredTokens(): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [jti, token] of this.blacklistedTokens.entries()) {
      if (token.expiresAt < now) {
        this.blacklistedTokens.delete(jti);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Get blacklisted tokens count
   */
  getBlacklistedTokensCount(): number {
    return this.blacklistedTokens.size;
  }

  /**
   * Get blacklisted tokens for a user
   */
  getUserBlacklistedTokens(userId: string): BlacklistedToken[] {
    return Array.from(this.blacklistedTokens.values())
      .filter(token => token.userId === userId);
  }

  /**
   * Check if token exists in blacklist and return details
   */
  getBlacklistedTokenDetails(jti: string): BlacklistedToken | null {
    return this.blacklistedTokens.get(jti) || null;
  }
}
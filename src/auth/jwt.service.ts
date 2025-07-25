import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';

export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class JwtService {
  constructor(
    private readonly nestJwtService: NestJwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateTokenPair(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<TokenPair> {
    const accessToken = await this.nestJwtService.signAsync(payload, {
      secret: this.configService.get('security.jwt.secret'),
      expiresIn: this.configService.get('security.jwt.expiresIn'),
    });

    const refreshToken = await this.nestJwtService.signAsync(
      { sub: payload.sub, type: 'refresh' },
      {
        secret: this.configService.get('security.jwt.secret'),
        expiresIn: this.configService.get('security.jwt.refreshExpiresIn'),
      },
    );

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.nestJwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get('security.jwt.secret'),
      });

      if (!payload.sub || !payload.username) {
        throw new UnauthorizedException('Invalid token payload');
      }

      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async verifyRefreshToken(token: string): Promise<{ sub: string }> {
    try {
      const payload = await this.nestJwtService.verifyAsync<{ sub: string; type: string }>(token, {
        secret: this.configService.get('security.jwt.secret'),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return { sub: payload.sub };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) return null;
    
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' && token ? token : null;
  }

  async refreshAccessToken(refreshToken: string, userPayload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
    const { sub } = await this.verifyRefreshToken(refreshToken);
    
    if (sub !== userPayload.sub) {
      throw new UnauthorizedException('Refresh token does not match user');
    }

    return this.nestJwtService.signAsync(userPayload, {
      secret: this.configService.get('security.jwt.secret'),
      expiresIn: this.configService.get('security.jwt.expiresIn'),
    });
  }
}
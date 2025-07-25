import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { JwtService } from './jwt.service';
import { Role, Permission } from './types/auth.types';

describe('JwtService', () => {
  let service: JwtService;
  let nestJwtService: NestJwtService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtService,
        {
          provide: NestJwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'security.jwt.secret': 'test-secret',
                'security.jwt.expiresIn': '1h',
                'security.jwt.refreshExpiresIn': '7d',
              };
              return config[key as keyof typeof config];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<JwtService>(JwtService);
    nestJwtService = module.get<NestJwtService>(NestJwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('generateTokenPair', () => {
    it('should generate access and refresh tokens', async () => {
      const payload = {
        sub: '123',
        username: 'testuser',
        email: 'test@example.com',
        roles: [Role.USER],
        permissions: [Permission.READ_USER],
      };

      (nestJwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.generateTokenPair(payload);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(nestJwtService.signAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid token', async () => {
      const mockPayload = {
        sub: '123',
        username: 'testuser',
        email: 'test@example.com',
        roles: [Role.USER],
        permissions: [Permission.READ_USER],
      };

      (nestJwtService.verifyAsync as jest.Mock).mockResolvedValue(mockPayload);

      const result = await service.verifyAccessToken('valid-token');

      expect(result).toEqual(mockPayload);
      expect(nestJwtService.verifyAsync).toHaveBeenCalledWith('valid-token', {
        secret: 'test-secret',
      });
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      (nestJwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error('Invalid token'));

      await expect(service.verifyAccessToken('invalid-token')).rejects.toThrow(
        'Invalid or expired token'
      );
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from Bearer header', () => {
      const result = service.extractTokenFromHeader('Bearer test-token');
      expect(result).toBe('test-token');
    });

    it('should return null for invalid header format', () => {
      const result = service.extractTokenFromHeader('Invalid header');
      expect(result).toBeNull();
    });

    it('should return null for undefined header', () => {
      const result = service.extractTokenFromHeader(undefined);
      expect(result).toBeNull();
    });
  });
});
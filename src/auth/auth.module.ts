import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from './jwt.service';
import { PasswordService } from './password.service';
import { RbacService } from './rbac.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('security.jwt.secret'),
        signOptions: {
          expiresIn: configService.get('security.jwt.expiresIn'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    JwtService,
    PasswordService,
    RbacService,
    TokenBlacklistService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [
    JwtService,
    PasswordService,
    RbacService,
    TokenBlacklistService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
})
export class AuthModule {}
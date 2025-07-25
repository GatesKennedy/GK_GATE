import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './monitoring/health.module';
import { AuthModule } from './auth/auth.module';
import { AuthController } from './auth/auth.controller';
import { GatewayModule } from './gateway/gateway.module';
import { GatewayAdminController } from './gateway/gateway-admin.controller';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { appConfig, securityConfig, gatewayConfig } from './config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, securityConfig, gatewayConfig],
      envFilePath: ['.env.local', '.env'],
      cache: true,
      expandVariables: true,
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            name: 'short',
            ttl: 1000, // 1 second
            limit: 10,
          },
          {
            name: 'medium',
            ttl: 10000, // 10 seconds
            limit: 20,
          },
          {
            name: 'long',
            ttl: 60000, // 1 minute
            limit: 100,
          },
        ],
      }),
    }),

    // Feature modules
    HealthModule,
    AuthModule,
    GatewayModule,
  ],
  controllers: [AuthController, GatewayAdminController],
  providers: [
    // Global guards
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
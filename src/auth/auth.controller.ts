import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from './jwt.service';
import { PasswordService } from './password.service';
import { RbacService } from './rbac.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { Public, CurrentUser, Roles, RequirePermissions } from './decorators';
import { Role, Permission } from './types/auth.types';
import { ValidateBody } from '../validation';
import { LoginSchema, RegisterSchema, LoginDto, RegisterDto } from '../validation/auth.schemas';

@Controller('auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuthController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly rbacService: RbacService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ValidateBody(LoginSchema)
  async login(@Body() loginDto: LoginDto) {
    // In a real app, you'd validate against a database
    const mockUser = {
      sub: '123e4567-e89b-12d3-a456-426614174000',
      username: loginDto.username,
      email: `${loginDto.username}@example.com`,
      roles: [Role.USER] as Role[],
      permissions: [] as Permission[],
    };

    // Validate password (mock validation for demo)
    const isValidPassword = await this.passwordService.verifyPassword(
      'hashedPassword', // This would come from database
      loginDto.password
    );

    if (!isValidPassword) {
      // In real app, use proper authentication logic
      // For demo, accept any password for valid format
    }

    const effectivePermissions = this.rbacService.getEffectivePermissions(mockUser);
    
    const tokenPayload = {
      ...mockUser,
      permissions: effectivePermissions,
    };

    const tokens = await this.jwtService.generateTokenPair(tokenPayload);

    return {
      message: 'Login successful',
      user: {
        id: mockUser.sub,
        username: mockUser.username,
        email: mockUser.email,
        roles: mockUser.roles,
        permissions: effectivePermissions,
      },
      tokens,
    };
  }

  @Public()
  @Post('register')
  @ValidateBody(RegisterSchema)
  async register(@Body() registerDto: RegisterDto) {
    // Validate password strength
    const passwordValidation = this.passwordService.validatePasswordStrength(registerDto.password);
    
    if (!passwordValidation.isValid) {
      return {
        message: 'Password validation failed',
        errors: passwordValidation.errors,
      };
    }

    // Hash password
    await this.passwordService.hashPassword(registerDto.password);

    // Mock user creation (in real app, save to database)
    const newUser = {
      sub: crypto.randomUUID(),
      username: registerDto.username,
      email: registerDto.email,
      roles: [Role.USER] as Role[],
      permissions: [] as Permission[],
    };

    const effectivePermissions = this.rbacService.getEffectivePermissions(newUser);
    
    const tokenPayload = {
      ...newUser,
      permissions: effectivePermissions,
    };

    const tokens = await this.jwtService.generateTokenPair(tokenPayload);

    return {
      message: 'Registration successful',
      user: {
        id: newUser.sub,
        username: newUser.username,
        email: newUser.email,
        roles: newUser.roles,
        permissions: effectivePermissions,
      },
      tokens,
    };
  }

  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    return {
      message: 'Profile retrieved successfully',
      user: {
        id: user.sub,
        username: user.username,
        email: user.email,
        roles: user.roles,
        permissions: user.permissions,
      },
    };
  }

  @Get('admin-only')
  @Roles(Role.ADMIN)
  async adminOnlyEndpoint(@CurrentUser() user: any) {
    return {
      message: 'Admin access granted',
      user: user.username,
    };
  }

  @Get('view-metrics')
  @RequirePermissions(Permission.VIEW_METRICS)
  async viewMetrics(@CurrentUser() user: any) {
    return {
      message: 'Metrics access granted',
      user: user.username,
      metrics: {
        requests: 1234,
        errors: 5,
        uptime: '99.9%',
      },
    };
  }
}
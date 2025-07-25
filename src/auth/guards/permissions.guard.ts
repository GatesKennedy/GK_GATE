import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from '../rbac.service';
import { Permission, Role } from '../types/auth.types';
import { PERMISSIONS_KEY, PERMISSION_LOGIC_KEY, PermissionLogic } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not found in request context');
    }

    // Check role-based access
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles) {
      const hasRole = this.rbacService.hasAnyRole(user.roles, requiredRoles);
      if (!hasRole) {
        throw new ForbiddenException(
          `Access denied. Required roles: ${requiredRoles.join(', ')}`
        );
      }
    }

    // Check permission-based access
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredPermissions) {
      const permissionLogic = this.reflector.getAllAndOverride<PermissionLogic>(
        PERMISSION_LOGIC_KEY,
        [context.getHandler(), context.getClass()],
      ) || PermissionLogic.OR;

      const userPermissions = this.rbacService.getEffectivePermissions(user);

      let hasPermission: boolean;
      if (permissionLogic === PermissionLogic.AND) {
        hasPermission = this.rbacService.hasAllPermissions(userPermissions, requiredPermissions);
      } else {
        hasPermission = this.rbacService.hasAnyPermission(userPermissions, requiredPermissions);
      }

      if (!hasPermission) {
        throw new ForbiddenException(
          `Access denied. Required permissions: ${requiredPermissions.join(', ')}`
        );
      }
    }

    return true;
  }
}
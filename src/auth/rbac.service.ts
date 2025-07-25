import { Injectable } from '@nestjs/common';
import { Role, Permission, ROLE_PERMISSIONS, User } from './types/auth.types';

@Injectable()
export class RbacService {
  /**
   * Get all permissions for given roles
   */
  getPermissionsForRoles(roles: Role[]): Permission[] {
    const permissions = new Set<Permission>();

    roles.forEach(role => {
      ROLE_PERMISSIONS[role]?.forEach(permission => {
        permissions.add(permission);
      });
    });

    return Array.from(permissions);
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(userPermissions: Permission[], requiredPermission: Permission): boolean {
    return userPermissions.includes(requiredPermission);
  }

  /**
   * Check if user has any of the required permissions
   */
  hasAnyPermission(userPermissions: Permission[], requiredPermissions: Permission[]): boolean {
    return requiredPermissions.some(permission => 
      this.hasPermission(userPermissions, permission)
    );
  }

  /**
   * Check if user has all required permissions
   */
  hasAllPermissions(userPermissions: Permission[], requiredPermissions: Permission[]): boolean {
    return requiredPermissions.every(permission => 
      this.hasPermission(userPermissions, permission)
    );
  }

  /**
   * Check if user has specific role
   */
  hasRole(userRoles: Role[], requiredRole: Role): boolean {
    return userRoles.includes(requiredRole);
  }

  /**
   * Check if user has any of the required roles
   */
  hasAnyRole(userRoles: Role[], requiredRoles: Role[]): boolean {
    return requiredRoles.some(role => this.hasRole(userRoles, role));
  }

  /**
   * Get effective permissions for a user (roles + direct permissions)
   */
  getEffectivePermissions(user: Partial<User>): Permission[] {
    const rolePermissions = user.roles ? this.getPermissionsForRoles(user.roles) : [];
    const directPermissions = user.permissions || [];

    // Combine and deduplicate
    const allPermissions = new Set([...rolePermissions, ...directPermissions]);
    return Array.from(allPermissions);
  }

  /**
   * Check if user can perform action on resource
   */
  canPerform(
    userPermissions: Permission[],
    requiredPermission: Permission,
    resource?: any,
    context?: any
  ): boolean {
    // Basic permission check
    if (!this.hasPermission(userPermissions, requiredPermission)) {
      return false;
    }

    // Additional context-based checks can be added here
    // For example, checking if user owns the resource
    if (resource && context) {
      // Implement resource-specific authorization logic
      return this.checkResourceAccess(userPermissions, resource, context);
    }

    return true;
  }

  /**
   * Resource-specific access control
   */
  private checkResourceAccess(
    userPermissions: Permission[],
    _resource: any,
    _context: any
  ): boolean {
    // This can be extended for specific resource access patterns
    // For example:
    // - User can only access their own resources
    // - Admin can access all resources
    // - Moderator can access resources in their domain

    if (this.hasPermission(userPermissions, Permission.ACCESS_ADMIN)) {
      return true; // Admin can access everything
    }

    // Add more specific logic based on your requirements
    return true;
  }

  /**
   * Get role hierarchy (higher roles include lower role permissions)
   */
  getRoleHierarchy(role: Role): Role[] {
    const hierarchy: Record<Role, Role[]> = {
      [Role.GUEST]: [Role.GUEST],
      [Role.USER]: [Role.GUEST, Role.USER],
      [Role.MODERATOR]: [Role.GUEST, Role.USER, Role.MODERATOR],
      [Role.ADMIN]: [Role.GUEST, Role.USER, Role.MODERATOR, Role.ADMIN],
    };

    return hierarchy[role] || [role];
  }
}
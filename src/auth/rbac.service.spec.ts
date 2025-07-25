import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from './rbac.service';
import { Role, Permission } from './types/auth.types';

describe('RbacService', () => {
  let service: RbacService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RbacService],
    }).compile();

    service = module.get<RbacService>(RbacService);
  });

  describe('getPermissionsForRoles', () => {
    it('should return admin permissions for admin role', () => {
      const permissions = service.getPermissionsForRoles([Role.ADMIN]);
      
      expect(permissions).toContain(Permission.CREATE_USER);
      expect(permissions).toContain(Permission.DELETE_USER);
      expect(permissions).toContain(Permission.ACCESS_ADMIN);
      expect(permissions.length).toBeGreaterThan(5);
    });

    it('should return user permissions for user role', () => {
      const permissions = service.getPermissionsForRoles([Role.USER]);
      
      expect(permissions).toContain(Permission.READ_USER);
      expect(permissions).not.toContain(Permission.DELETE_USER);
    });

    it('should combine permissions for multiple roles', () => {
      const permissions = service.getPermissionsForRoles([Role.USER, Role.MODERATOR]);
      
      expect(permissions).toContain(Permission.READ_USER);
      expect(permissions).toContain(Permission.UPDATE_USER);
      expect(permissions).toContain(Permission.VIEW_METRICS);
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has permission', () => {
      const userPermissions = [Permission.READ_USER, Permission.VIEW_METRICS];
      
      const result = service.hasPermission(userPermissions, Permission.READ_USER);
      
      expect(result).toBe(true);
    });

    it('should return false when user lacks permission', () => {
      const userPermissions = [Permission.READ_USER];
      
      const result = service.hasPermission(userPermissions, Permission.DELETE_USER);
      
      expect(result).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should return true when user has role', () => {
      const userRoles = [Role.USER, Role.MODERATOR];
      
      const result = service.hasRole(userRoles, Role.USER);
      
      expect(result).toBe(true);
    });

    it('should return false when user lacks role', () => {
      const userRoles = [Role.USER];
      
      const result = service.hasRole(userRoles, Role.ADMIN);
      
      expect(result).toBe(false);
    });
  });

  describe('getEffectivePermissions', () => {
    it('should combine role and direct permissions', () => {
      const user = {
        roles: [Role.USER],
        permissions: [Permission.VIEW_METRICS],
      };

      const result = service.getEffectivePermissions(user);

      expect(result).toContain(Permission.READ_USER); // from role
      expect(result).toContain(Permission.VIEW_METRICS); // direct permission
    });

    it('should deduplicate permissions', () => {
      const user = {
        roles: [Role.USER],
        permissions: [Permission.READ_USER], // duplicate from role
      };

      const result = service.getEffectivePermissions(user);
      const readUserCount = result.filter(p => p === Permission.READ_USER).length;

      expect(readUserCount).toBe(1);
    });
  });
});
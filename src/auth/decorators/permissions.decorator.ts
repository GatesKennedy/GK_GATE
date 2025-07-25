import { SetMetadata } from '@nestjs/common';
import { Permission } from '../types/auth.types';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: Permission[]) => 
  SetMetadata(PERMISSIONS_KEY, permissions);

export const PERMISSION_LOGIC_KEY = 'permissionLogic';
export enum PermissionLogic {
  AND = 'AND', // All permissions required
  OR = 'OR',   // Any permission required
}

export const SetPermissionLogic = (logic: PermissionLogic) => 
  SetMetadata(PERMISSION_LOGIC_KEY, logic);
export enum Role {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator',
  GUEST = 'guest',
}

export enum Permission {
  // User management
  CREATE_USER = 'create:user',
  READ_USER = 'read:user',
  UPDATE_USER = 'update:user',
  DELETE_USER = 'delete:user',

  // Gateway management
  CONFIGURE_ROUTES = 'configure:routes',
  VIEW_METRICS = 'view:metrics',
  MANAGE_RATE_LIMITS = 'manage:rate_limits',

  // System management
  VIEW_LOGS = 'view:logs',
  MANAGE_SYSTEM = 'manage:system',
  ACCESS_ADMIN = 'access:admin',
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    Permission.CREATE_USER,
    Permission.READ_USER,
    Permission.UPDATE_USER,
    Permission.DELETE_USER,
    Permission.CONFIGURE_ROUTES,
    Permission.VIEW_METRICS,
    Permission.MANAGE_RATE_LIMITS,
    Permission.VIEW_LOGS,
    Permission.MANAGE_SYSTEM,
    Permission.ACCESS_ADMIN,
  ],
  [Role.MODERATOR]: [
    Permission.READ_USER,
    Permission.UPDATE_USER,
    Permission.VIEW_METRICS,
    Permission.VIEW_LOGS,
  ],
  [Role.USER]: [
    Permission.READ_USER,
  ],
  [Role.GUEST]: [],
};

export interface User {
  id: string;
  username: string;
  email: string;
  roles: Role[];
  permissions: Permission[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
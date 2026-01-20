import { SetMetadata } from '@nestjs/common';
import { Role } from '@/types/shared';

export const REQUIRED_ROLES_KEY = 'roles';

export const RequireRoles = (...roles: Role[]) => SetMetadata(REQUIRED_ROLES_KEY, roles);

// Alias for backward compatibility
export const Roles = RequireRoles;

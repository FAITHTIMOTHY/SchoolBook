import type { UserRole } from '@prisma/client';
import {
  ACCESS_TOKEN_TYPE,
  OAUTH_STATE_TYPE,
  REFRESH_TOKEN_TYPE,
} from './auth.constants.js';

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  tenantSlug: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  emailVerifiedAt?: Date | null;
}

export interface JwtAccessPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: UserRole;
  type: typeof ACCESS_TOKEN_TYPE;
}

export interface JwtRefreshPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: UserRole;
  type: typeof REFRESH_TOKEN_TYPE;
  jti: string;
}

export interface OAuthStatePayload {
  tenant: string;
  type: typeof OAUTH_STATE_TYPE;
}

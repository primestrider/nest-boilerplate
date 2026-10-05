import type { UserRole } from '../../infrastructure/database/schema/index.js';

/** Claims carried by the access token. */
export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

/** The authenticated principal attached to `request.user`. */
export interface AuthUser {
  id: string;
  role: UserRole;
}

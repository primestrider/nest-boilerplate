/**
 * Stable, machine-readable error codes (the `code` member of a problem
 * response). Clients branch on these, never on `detail` text, so a code must
 * not change once released. Generic codes are derived from the HTTP status
 * (see `codeForStatus`); add domain-specific ones here.
 */
export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_REFRESH_TOKEN'
  | 'USER_NOT_FOUND';

/** "Payload Too Large" -> "PAYLOAD_TOO_LARGE". */
export function codeForStatus(title: string): string {
  return title.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from './error-code.js';
import type { FieldErrorDto } from './problem-details.dto.js';

/**
 * An expected, client-facing error with a stable `code`. `detail` is shown to
 * clients, so it must never contain internal information.
 *
 * Nest's built-in exceptions (NotFoundException, ...) still work; they get a
 * generic code derived from their status.
 */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    detail: string,
    readonly errors?: FieldErrorDto[],
  ) {
    super(detail, status);
  }
}

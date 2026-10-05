import { HttpStatus, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { AppException } from './app.exception.js';
import type { FieldErrorDto } from './problem-details.dto.js';

/** Flattens class-validator's nested tree into one entry per failed rule. */
export function toFieldErrors(
  errors: ValidationError[],
  parentPath = '',
): FieldErrorDto[] {
  return errors.flatMap((error) => {
    const field = !parentPath
      ? error.property
      : /^\d+$/.test(error.property)
        ? `${parentPath}[${error.property}]`
        : `${parentPath}.${error.property}`;

    const own = Object.entries(error.constraints ?? {}).map(
      ([code, message]) => ({ field, code, message }),
    );
    return [...own, ...toFieldErrors(error.children ?? [], field)];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Validation failed',
        toFieldErrors(errors),
      ),
  });
}

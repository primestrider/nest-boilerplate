import { ApiProperty } from '@nestjs/swagger';

export class FieldErrorDto {
  /** Path to the invalid input, e.g. `email` or `items[0].quantity`. */
  field: string;
  /** Failed rule, e.g. `isEmail`, `minLength`. */
  code: string;
  message: string;
}

/**
 * Error body per RFC 9457 (Problem Details for HTTP APIs), served as
 * `application/problem+json`. `code`, `requestId` and `errors` are extension
 * members.
 */
export class ProblemDetailsDto {
  @ApiProperty({ example: 'about:blank' })
  type: string;
  @ApiProperty({ example: 'Bad Request' })
  title: string;
  @ApiProperty({ example: 400 })
  status: number;
  @ApiProperty({ example: 'Validation failed' })
  detail: string;
  @ApiProperty({ example: '/api/v1/auth/register' })
  instance: string;
  /** Stable machine-readable code; branch on this, not on `detail`. */
  @ApiProperty({ example: 'VALIDATION_FAILED' })
  code: string;
  /** Matches the `x-request-id` header and the server logs. */
  requestId?: string;
  /** Present for validation failures. */
  errors?: FieldErrorDto[];
}

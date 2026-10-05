import { STATUS_CODES } from 'node:http';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AppException } from '../errors/app.exception.js';
import { codeForStatus } from '../errors/error-code.js';
import type { ProblemDetailsDto } from '../errors/problem-details.dto.js';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/** Renders every error as RFC 9457 Problem Details. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    // Set by the request-id middleware; lets clients quote an id that matches
    // the server logs.
    const request = ctx.getRequest<{ id?: string | number }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : isExposedClientError(exception)
          ? exception.status
          : HttpStatus.INTERNAL_SERVER_ERROR;

    // Client errors are expected; only server errors are worth a stack trace.
    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const title = STATUS_CODES[status] ?? 'Error';
    const body: ProblemDetailsDto = {
      type: 'about:blank',
      title,
      status,
      detail: title,
      code: codeForStatus(title),
      ...describe(exception, status),
      // Path only: query strings can carry tokens or personal data.
      instance: httpAdapter.getRequestUrl(request).split('?')[0],
      requestId: request.id === undefined ? undefined : String(request.id),
    };

    const response = ctx.getResponse();
    httpAdapter.setHeader(response, 'Content-Type', PROBLEM_CONTENT_TYPE);
    httpAdapter.reply(response, body, status);
  }
}

/**
 * Errors raised by Express middleware (e.g. body-parser's 413 "request entity
 * too large") follow the `http-errors` convention: a 4xx `status` plus
 * `expose: true` when the message is safe to show. Requiring `expose` keeps
 * other libraries' `status` fields (e.g. an upstream HTTP client's response
 * status) from leaking through as our own.
 */
function isExposedClientError(
  exception: unknown,
): exception is Error & { status: number } {
  if (!(exception instanceof Error)) return false;
  const { status, expose } = exception as {
    status?: unknown;
    expose?: unknown;
  };
  return (
    expose === true &&
    typeof status === 'number' &&
    status >= 400 &&
    status < 500
  );
}

/** Overrides of the status-derived defaults (title as detail, generic code). */
function describe(
  exception: unknown,
  status: number,
): Partial<ProblemDetailsDto> {
  if (exception instanceof AppException) {
    return {
      code: exception.code,
      detail: exception.message,
      errors: exception.errors,
    };
  }

  // Never leak internal error details to clients.
  if (status >= 500) return {};

  if (isExposedClientError(exception)) return { detail: exception.message };

  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    const message =
      typeof response === 'string'
        ? response
        : (response as { message?: unknown }).message;
    if (typeof message === 'string') return { detail: message };
    if (Array.isArray(message)) return { detail: message.join('; ') };
  }

  return {};
}

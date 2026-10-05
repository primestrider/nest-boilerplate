import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  requestId?: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    // Set by pino-http; lets clients quote an id that matches the server logs.
    const request = ctx.getRequest<{ id?: string | number }>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Client errors are expected; only server errors are worth a stack trace.
    if (statusCode >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorResponse = {
      statusCode,
      ...describe(exception),
      path: httpAdapter.getRequestUrl(request),
      requestId: request.id === undefined ? undefined : String(request.id),
      timestamp: new Date().toISOString(),
    };

    httpAdapter.reply(ctx.getResponse(), body, statusCode);
  }
}

function describe(
  exception: unknown,
): Pick<ErrorResponse, 'error' | 'message'> {
  if (!(exception instanceof HttpException)) {
    // Never leak internal error details to clients.
    return {
      error: 'Internal Server Error',
      message: 'Internal server error',
    };
  }

  const response = exception.getResponse();
  if (typeof response === 'string') {
    return { error: exception.name, message: response };
  }

  const { error, message } = response as {
    error?: string;
    message?: string | string[];
  };
  return {
    error: error ?? exception.name,
    message: message ?? exception.message,
  };
}

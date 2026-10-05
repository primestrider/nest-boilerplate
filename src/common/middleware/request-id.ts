import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const REQUEST_ID_HEADER = 'x-request-id';

// Accept an upstream id (gateway/load balancer) only if it is short and
// plain, so clients cannot inject arbitrary content into logs.
const VALID_REQUEST_ID = /^[\w-]{1,128}$/;

type RequestWithId = IncomingMessage & { id?: unknown };

/**
 * Resolves the request id once per request and echoes it in the response.
 * Idempotent: the app-level middleware assigns it before body parsing (so
 * parser errors carry it too) and pino-http reuses the same value.
 */
export function assignRequestId(
  req: RequestWithId,
  res: ServerResponse,
): string {
  if (typeof req.id === 'string') return req.id;

  const incoming = req.headers[REQUEST_ID_HEADER];
  const id =
    typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming)
      ? incoming
      : randomUUID();
  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  return id;
}

export function requestIdMiddleware(
  req: RequestWithId,
  res: ServerResponse,
  next: () => void,
): void {
  assignRequestId(req, res);
  next();
}

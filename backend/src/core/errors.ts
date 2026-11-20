import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logError } from "./logger.js";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "DATA_NOT_AVAILABLE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface ApiErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    request_id: string;
    retryable: boolean;
  };
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly retryable: boolean;

  constructor(options: {
    code: ErrorCode;
    message: string;
    statusCode: number;
    retryable?: boolean;
  }) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
  }
}

export function buildErrorEnvelope(
  code: ErrorCode,
  message: string,
  requestId: string,
  retryable = false
): ApiErrorEnvelope {
  return {
    error: {
      code,
      message,
      request_id: requestId,
      retryable,
    },
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  const requestId = req.requestId ?? "req_unknown";
  res
    .status(404)
    .json(
      buildErrorEnvelope("NOT_FOUND", "The requested API endpoint does not exist.", requestId, false)
    );
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId ?? "req_unknown";

  if (err instanceof AppError) {
    logError("api.app_error", {
      request_id: requestId,
      code: err.code,
      status_code: err.statusCode,
      path: req.path,
      method: req.method,
    });
    res
      .status(err.statusCode)
      .json(buildErrorEnvelope(err.code, err.message, requestId, err.retryable));
    return;
  }

  if (err instanceof ZodError) {
    logError("api.validation_error", {
      request_id: requestId,
      issue_count: err.issues.length,
      path: req.path,
      method: req.method,
    });
    res
      .status(400)
      .json(
        buildErrorEnvelope(
          "VALIDATION_ERROR",
          "The request payload or query parameters are invalid.",
          requestId,
          false
        )
      );
    return;
  }

  // Never leak stack traces, SQL errors, secrets, or raw user text to clients.
  logError("api.internal_error", {
    request_id: requestId,
    error_name: err instanceof Error ? err.name : "UnknownError",
    path: req.path,
    method: req.method,
  });

  res
    .status(500)
    .json(
      buildErrorEnvelope(
        "INTERNAL_ERROR",
        "An unexpected server error occurred. Please try again.",
        requestId,
        true
      )
    );
}

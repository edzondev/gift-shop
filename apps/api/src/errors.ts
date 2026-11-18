import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { RequestIdVariables } from "hono/request-id";

export type ApiEnv = {
  Bindings: CloudflareBindings;
  Variables: RequestIdVariables;
};

type ErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

function errorBody(code: string, message: string): ErrorBody {
  return { error: { code, message } };
}

export function validationError(issues: { path: string; message: string }[]) {
  return {
    error: {
      code: "validation_error",
      message: "Validation failed",
      details: { issues },
    },
  };
}

export function productNotFound() {
  return {
    error: {
      code: "product_not_found",
      message: "Product not found",
    },
  };
}

export function fileTooLarge() {
  return {
    error: {
      code: "file_too_large",
      message: "File is too large",
    },
  };
}

export function unsupportedFileType() {
  return {
    error: {
      code: "unsupported_file_type",
      message: "Unsupported file type",
    },
  };
}

export function productUnavailable(productIds: string[]) {
  return {
    error: {
      code: "product_unavailable",
      message: "Product is unavailable",
      details: { productIds },
    },
  };
}

export function outOfStock(productIds: string[]) {
  return {
    error: {
      code: "out_of_stock",
      message: "Not enough stock",
      details: { productIds },
    },
  };
}

export function priceChanged(totalCents: number) {
  return {
    error: {
      code: "price_changed",
      message: "Price changed",
      details: { totalCents },
    },
  };
}

export function idempotencyConflict() {
  return {
    error: {
      code: "idempotency_conflict",
      message: "Idempotency key was reused with a different request",
    },
  };
}

export function deliveryDateTooSoon() {
  return {
    error: {
      code: "delivery_date_too_soon",
      message: "Delivery date is too soon",
    },
  };
}

export function orderNotFound() {
  return {
    error: {
      code: "order_not_found",
      message: "Order not found",
    },
  };
}

function errorCode(status: number): string {
  switch (status) {
    case 400:
      return "bad_request";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 405:
      return "method_not_allowed";
    case 409:
      return "conflict";
    case 422:
      return "unprocessable_entity";
    case 429:
      return "too_many_requests";
    case 500:
      return "internal_error";
    default:
      return "http_error";
  }
}

export function notFound(c: Context<ApiEnv>): Response {
  return c.json(errorBody("not_found", "Not Found"), 404);
}

export function onError(err: Error, c: Context<ApiEnv>): Response {
  if (err instanceof HTTPException) {
    return c.json(errorBody(errorCode(err.status), err.message), err.status);
  }

  console.error(
    JSON.stringify({
      code: "internal_error",
      method: c.req.method,
      path: c.req.path,
      requestId: c.var.requestId,
      message: err.message,
    }),
  );

  return c.json(errorBody("internal_error", "Internal Server Error"), 500);
}

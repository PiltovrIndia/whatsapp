import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonOk(data = {}, init = {}) {
  return NextResponse.json(data, init);
}

export function jsonError(message, status = 400, details) {
  return NextResponse.json(
    {
      error: message,
      details,
    },
    { status }
  );
}

export function httpError(status, message, meta) {
  const error = new Error(message);
  error.status = status;
  if (meta) error.meta = meta;
  return error;
}

function zodMessage(error) {
  const issue = error.issues?.[0];
  if (!issue) return "Invalid request payload.";
  const path = issue.path?.length ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}

export function handleApiError(error) {
  if (error instanceof ZodError) {
    return jsonError(zodMessage(error), 422, error.flatten());
  }

  if (error?.message?.includes("MySQL is not configured")) {
    return jsonError(error.message, 503);
  }

  if (error?.status) {
    return jsonError(error.message, error.status, error.meta);
  }

  if (error?.code === "ER_DUP_ENTRY") {
    return jsonError("A matching record already exists.", 409);
  }

  if (error?.code === "ECONNREFUSED" || error?.code === "ETIMEDOUT" || error?.code === "PROTOCOL_CONNECTION_LOST") {
    console.error(error);
    return jsonError("The database is unavailable. Try again shortly.", 503);
  }

  console.error(error);
  return jsonError("Unexpected server error.", 500);
}

export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

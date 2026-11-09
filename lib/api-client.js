"use client";

/** fetch wrapper: JSON in/out, throws Error(message) on failure, redirects to login on 401. */
export async function api(path, { method = "GET", body, form } = {}) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && typeof window !== "undefined") {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.details = data.details;
    throw error;
  }
  return data;
}

export function formatDate(value, { time = true } = {}) {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function contactName(contact) {
  const name = `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
  return name || contact.phone;
}

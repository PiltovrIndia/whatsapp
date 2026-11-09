import { httpError } from "@/lib/server/http";

export const MEDIA_RULES = {
  IMAGE: { types: ["image/jpeg", "image/png"], maxBytes: 5 * 1024 * 1024 },
  VIDEO: { types: ["video/mp4", "video/3gpp"], maxBytes: 16 * 1024 * 1024 },
  DOCUMENT: { types: ["application/pdf"], maxBytes: 100 * 1024 * 1024 },
};

/** Reads and validates an uploaded file from multipart form data. */
export async function readMediaUpload(request) {
  const form = await request.formData();
  const file = form.get("file");
  const format = String(form.get("format") || "").toUpperCase();
  const rule = MEDIA_RULES[format];

  if (!rule) throw httpError(422, "Choose an image, video or document header.");
  if (!file || typeof file === "string") throw httpError(422, "Attach a file to upload.");
  if (!rule.types.includes(file.type)) {
    throw httpError(422, `Unsupported file type. Use ${rule.types.join(", ")}.`);
  }
  if (file.size > rule.maxBytes) {
    throw httpError(422, `File is too large. The limit is ${Math.round(rule.maxBytes / 1024 / 1024)} MB.`);
  }

  return {
    bytes: new Uint8Array(await file.arrayBuffer()),
    fileName: file.name || "upload",
    mimeType: file.type,
    format,
  };
}

import { env } from "#config/env";
import { AppError } from "#shared/utils/app-error";

export function isPdfGeneratorConfigured() {
  return Boolean(env.PDF_GENERATOR_BASE_URL && env.PDF_GENERATOR_API_KEY);
}

async function readErrorPayload(response) {
  const text = await response.text().catch(() => "");

  if (!text) {
    return { text: "", message: "" };
  }

  try {
    const json = JSON.parse(text);
    return {
      text,
      code: json.code,
      message: json.message ?? json.error ?? text
    };
  } catch {
    return { text, message: text };
  }
}

export async function generatePdfFromTemplate({ template, filename, data }) {
  if (!isPdfGeneratorConfigured()) {
    throw new AppError("PDF generator API is not configured", 500);
  }

  const endpoint = new URL("/generate", env.PDF_GENERATOR_BASE_URL);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Accept": "application/pdf",
      "Content-Type": "application/json",
      "X-API-Key": env.PDF_GENERATOR_API_KEY
    },
    body: JSON.stringify({
      template,
      filename,
      data
    }),
    signal: AbortSignal.timeout(env.PDF_GENERATOR_TIMEOUT_MS)
  });

  if (!response.ok) {
    const errorPayload = await readErrorPayload(response);
    const upstreamStatus = response.status;
    const isUpstreamAuthError = upstreamStatus === 401 || upstreamStatus === 403;

    throw new AppError(
      isUpstreamAuthError
        ? "PDF generator authentication failed. Check PDF_GENERATOR_API_KEY."
        : `PDF generator API failed with ${upstreamStatus}${errorPayload.message ? `: ${errorPayload.message}` : ""}`,
      isUpstreamAuthError || upstreamStatus >= 500 ? 502 : upstreamStatus,
      {
        code: isUpstreamAuthError ? "PDF_GENERATOR_AUTH_FAILED" : "PDF_GENERATOR_REQUEST_FAILED",
        upstreamStatus,
        upstreamCode: errorPayload.code
      }
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/pdf")) {
    throw new AppError(`PDF generator API returned unexpected content type: ${contentType || "unknown"}`, 502);
  }

  return Buffer.from(await response.arrayBuffer());
}

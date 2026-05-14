import { createSign } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "#shared/utils/app-error";
import { env } from "#config/env";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function parseJsonFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
}

function resolvePathFromEnv(value) {
  if (!value) return null;
  if (path.isAbsolute(value)) return value;
  return path.resolve(process.cwd(), value);
}

function getCandidateCredentialPaths() {
  const currentFilePath = fileURLToPath(import.meta.url);
  const nodeApiRoot = path.resolve(path.dirname(currentFilePath), "../../..");
  const projectRoot = path.resolve(nodeApiRoot, "..");
  const systemCredentialsV2Dir = path.join(projectRoot, "credentials", "v2");
  const nodeCredentialsV2Dir = path.join(nodeApiRoot, "credentials", "v2");

  return [
    resolvePathFromEnv(env.GOOGLE_VISION_CREDENTIALS),
    resolvePathFromEnv(env.GOOGLE_APPLICATION_CREDENTIALS),
    path.join(systemCredentialsV2Dir, "jrspc-492609-0cd45a2e3122.json"),
    path.join(systemCredentialsV2Dir, "jrspc-492609-8d34f2065d51.json"),
    path.join(systemCredentialsV2Dir, "jrspc-credentials.json"),
    path.join(nodeCredentialsV2Dir, "jrspc-492609-0cd45a2e3122.json"),
    path.join(nodeCredentialsV2Dir, "jrspc-492609-8d34f2065d51.json")
  ].filter(Boolean);
}

function resolveServiceAccountCredentials() {
  const candidates = getCandidateCredentialPaths();
  const validCandidates = [];

  for (const candidatePath of candidates) {
    if (!fs.existsSync(candidatePath)) {
      continue;
    }

    try {
      const json = parseJsonFile(candidatePath);
      if (json?.type === "service_account" && json?.client_email && json?.private_key) {
        validCandidates.push({
          filePath: candidatePath,
          json
        });
      }
    } catch {
      // Ignore
    }
  }

  if (validCandidates.length === 0) {
    throw new AppError("Google Vision service-account credentials were not found", 500);
  }

  const preferred = validCandidates.find(({ json, filePath }) =>
    String(json.client_email).toLowerCase().includes("ocr")
      || path.basename(filePath).toLowerCase().includes("ocr")
      || path.basename(filePath).includes("0cd45a2e3122")
  );

  return preferred ?? validCandidates[0];
}

async function getAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);

  if (cachedAccessToken && cachedAccessTokenExpiresAt > now + 60) {
    return cachedAccessToken;
  }

  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  const claims = {
    iss: credentials.client_email,
    scope: GOOGLE_SCOPE,
    aud: credentials.token_uri || GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now
  };

  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claims))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(credentials.private_key, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const assertion = `${unsignedToken}.${signature}`;

  const response = await fetch(credentials.token_uri || GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new AppError(`Failed to authenticate with Google Vision: ${errorText}`, 502);
  }

  const payload = await response.json();
  cachedAccessToken = payload.access_token;
  cachedAccessTokenExpiresAt = now + Number(payload.expires_in ?? 3600);

  return cachedAccessToken;
}

function extractReferenceNumber(text) {
  if (text.match(/Ref\s*No\.?\s*([\d\s]{6,20})/i)) {
    return text.match(/Ref\s*No\.?\s*([\d\s]{6,20})/i)[1].replace(/\s+/g, "");
  }
  if (text.match(/(?:CHEQUE|CHECK)\s*No\.?\s*([0-9]{4,10})/i)) {
    return text.match(/(?:CHEQUE|CHECK)\s*No\.?\s*([0-9]{4,10})/i)[1];
  }
  if (text.match(/No\.?\s*([0-9]{4,10})/i)) {
    return text.match(/No\.?\s*([0-9]{4,10})/i)[1];
  }
  if (text.match(/\b([0-9]{6,15})\b/)) {
    return text.match(/\b([0-9]{6,15})\b/)[1];
  }
  return "Not Found";
}

function extractAmount(text) {
  const match = text.match(/(?:PHP|Php|php|P|\$)?\s*([\d,]+\.\d{2})\b/);
  if (!match) return "0.00";
  return match[1].replace(/,/g, "");
}

function extractDate(text) {
  const now = new Date();
  const defaultDate = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
  return defaultDate; // Simple implementation for porting
}

function parseReceiptText(text) {
  const cleanText = String(text ?? "").replace(/\s+/g, " ").trim();
  return {
    reference_number: extractReferenceNumber(cleanText),
    amount: extractAmount(cleanText),
    date: extractDate(cleanText),
    full_text_preview: String(text ?? "")
  };
}

export class PaymentScannerService {
  async extractFromBuffer(buffer) {
    if (!buffer || buffer.length === 0) {
      throw new AppError("Payment receipt image is required", 400);
    }

    const { json: credentials } = resolveServiceAccountCredentials();
    const accessToken = await getAccessToken(credentials);

    const response = await fetch(GOOGLE_VISION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requests: [
          {
            image: { content: buffer.toString("base64") },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AppError(`Failed to process image with Google Vision: ${errorText}`, 502);
    }

    const payload = await response.json();
    const firstResponse = payload?.responses?.[0];
    if (firstResponse?.error?.message) throw new AppError(firstResponse.error.message, 502);

    const fullText = firstResponse?.fullTextAnnotation?.text
      ?? firstResponse?.textAnnotations?.[0]?.description
      ?? "";

    return parseReceiptText(fullText);
  }
}

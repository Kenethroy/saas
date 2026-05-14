import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "#config/env";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
// 4 levels up from src/shared/utils points to the workspace root (jrspc-system)
const projectRoot = path.resolve(currentDir, "../../../..");
const uploadsRoot = path.join(projectRoot, "uploads");
const productsUploadsDir = path.join(uploadsRoot, "products");
const paymentsUploadsDir = path.join(uploadsRoot, "payments");
const systemUploadsDir = path.join(uploadsRoot, "system");

export function ensureUploadsDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

export function getUploadsRootPath() {
  ensureUploadsDirectoryExists(uploadsRoot);
  return uploadsRoot;
}

export function getProductsUploadsDirectoryPath() {
  ensureUploadsDirectoryExists(productsUploadsDir);
  return productsUploadsDir;
}

export function getPaymentsUploadsDirectoryPath() {
  ensureUploadsDirectoryExists(paymentsUploadsDir);
  return paymentsUploadsDir;
}

export function getSystemUploadsDirectoryPath() {
  ensureUploadsDirectoryExists(systemUploadsDir);
  return systemUploadsDir;
}

export function buildProductUploadUrl(filename) {
  return `/uploads/products/${filename}`;
}

export function buildPaymentUploadUrl(filename) {
  return `/uploads/payments/${filename}`;
}

export function buildSystemUploadUrl(filename) {
  return `/uploads/system/${filename}`;
}

export function toPublicFileUrl(publicPath) {
  if (!publicPath) {
    return null;
  }

  if (/^https?:\/\//i.test(publicPath)) {
    return publicPath;
  }

  return `${env.PUBLIC_FILES_BASE_URL.replace(/\/$/, "")}${publicPath}`;
}

export function toStoredUploadPath(fileUrl) {
  if (fileUrl == null || fileUrl === "") {
    return fileUrl ?? null;
  }

  if (typeof fileUrl !== "string") {
    return null;
  }

  if (fileUrl.startsWith("/uploads/")) {
    return fileUrl;
  }

  try {
    const parsed = new URL(fileUrl);
    const uploadsIndex = parsed.pathname.indexOf("/uploads/");

    if (uploadsIndex === -1) {
      return null;
    }

    return parsed.pathname.slice(uploadsIndex);
  } catch {
    return null;
  }
}

export function resolveUploadPath(publicPath) {
  if (!publicPath || typeof publicPath !== "string" || !publicPath.startsWith("/uploads/")) {
    return null;
  }

  return path.join(projectRoot, publicPath.replace(/^\//, ""));
}

export function deleteUploadedFile(publicPath) {
  const absolutePath = resolveUploadPath(publicPath);

  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return;
  }

  fs.unlinkSync(absolutePath);
}

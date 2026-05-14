import { startTransition } from "react";

export function normalizePdfBlob(pdfData) {
  if (!pdfData) {
    return null;
  }

  if (pdfData instanceof Blob) {
    return pdfData;
  }

  if (pdfData instanceof ArrayBuffer) {
    return new Blob([pdfData], { type: "application/pdf" });
  }

  if (ArrayBuffer.isView(pdfData)) {
    return new Blob([pdfData], { type: "application/pdf" });
  }

  return null;
}

export async function extractBlobErrorMessage(error, fallbackMessage = "Failed to load PDF.") {
  const responseData = error?.response?.data;

  if (responseData instanceof Blob) {
    try {
      const text = await responseData.text();
      if (!text) {
        return fallbackMessage;
      }

      try {
        const parsed = JSON.parse(text);
        return parsed?.message ?? text;
      } catch {
        return text;
      }
    } catch {
      return fallbackMessage;
    }
  }

  return error?.response?.data?.message ?? error?.message ?? fallbackMessage;
}

export function openPdfViewer(navigate, viewerState) {
  startTransition(() => {
    navigate("/pdf-viewer", {
      state: viewerState
    });
  });
}

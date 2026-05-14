import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker?url";
import { useNotification } from "@/shared/hooks/useNotification";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function PdfViewerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useNotification();
  const canvasRef = useRef(null);
  const canvasWrapperRef = useRef(null);
  const pdfDocRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [documentVersion, setDocumentVersion] = useState(0);

  const viewerState = location.state ?? {};
  const title = viewerState.title ?? "PDF Document";
  const subtitle = viewerState.subtitle ?? "";
  const documentName = viewerState.documentName ?? "document.pdf";
  const fromPath = viewerState.fromPath;
  const pdfData = viewerState.pdfData;

  useEffect(() => {
    document.title = `${title} - JRSPC ERP`;
  }, [title]);

  useEffect(() => {
    let disposed = false;

    async function normalizePdfData() {
      if (!pdfData) {
        throw new Error("No PDF data was provided. Open the document again from its source page.");
      }

      if (typeof pdfData === "string" && pdfData.startsWith("data:")) {
        return dataUrlToBytes(pdfData);
      }

      if (typeof pdfData === "string") {
        const response = await fetch(pdfData);
        return new Uint8Array(await response.arrayBuffer());
      }

      if (pdfData instanceof Blob) {
        return new Uint8Array(await pdfData.arrayBuffer());
      }

      if (pdfData instanceof ArrayBuffer) {
        return new Uint8Array(pdfData);
      }

      if (ArrayBuffer.isView(pdfData)) {
        return new Uint8Array(pdfData.buffer, pdfData.byteOffset, pdfData.byteLength);
      }

      throw new Error("Unsupported PDF format.");
    }

    async function loadPdf() {
      setLoading(true);
      setError("");
      setCurrentPage(1);
      setPageInput("1");
      setTotalPages(0);
      setScale(1.5);

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }

      try {
        const data = await normalizePdfData();
        if (disposed) {
          return;
        }

        const loadingTask = pdfjsLib.getDocument({ data });
        const pdfDoc = await loadingTask.promise;
        if (disposed) {
          pdfDoc.destroy();
          return;
        }

        pdfDocRef.current = pdfDoc;
        setTotalPages(pdfDoc.numPages);
        setLoading(false);
        setDocumentVersion((version) => version + 1);
      } catch (loadError) {
        if (disposed) {
          return;
        }

        setLoading(false);
        setError(loadError?.message ?? "Failed to load PDF. Please try again.");
      }
    }

    loadPdf();

    return () => {
      disposed = true;

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [location.key, pdfData]);

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      const pdfDoc = pdfDocRef.current;
      const canvas = canvasRef.current;

      if (!pdfDoc || !canvas || loading || error) {
        return;
      }

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      try {
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) {
          return;
        }

        const viewport = page.getViewport({ scale });
        const context = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        renderTaskRef.current = page.render({
          canvasContext: context,
          viewport
        });

        await renderTaskRef.current.promise;
        renderTaskRef.current = null;
      } catch (renderError) {
        if (renderError?.name === "RenderingCancelledException" || cancelled) {
          return;
        }

        setError("Failed to render PDF page.");
      }
    }

    renderPage();

    return () => {
      cancelled = true;

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [currentPage, documentVersion, error, loading, scale]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  async function createPdfBlob() {
    if (pdfData instanceof Blob) {
      return pdfData;
    }

    if (pdfData instanceof ArrayBuffer) {
      return new Blob([pdfData], { type: "application/pdf" });
    }

    if (ArrayBuffer.isView(pdfData)) {
      return new Blob([pdfData], { type: "application/pdf" });
    }

    if (typeof pdfData === "string" && pdfData.startsWith("data:")) {
      return new Blob([dataUrlToBytes(pdfData)], { type: "application/pdf" });
    }

    if (typeof pdfData === "string") {
      const response = await fetch(pdfData);
      return new Blob([await response.arrayBuffer()], { type: "application/pdf" });
    }

    throw new Error("Unsupported PDF format.");
  }

  function handleBack() {
    if (fromPath) {
      navigate(fromPath);
      return;
    }

    navigate(-1);
  }

  function handlePreviousPage() {
    setCurrentPage((page) => Math.max(page - 1, 1));
  }

  function handleNextPage() {
    setCurrentPage((page) => Math.min(page + 1, totalPages));
  }

  function handleCommitPageInput() {
    if (!totalPages) {
      return;
    }

    const parsed = Number.parseInt(pageInput, 10);
    const nextPage = Number.isNaN(parsed) ? currentPage : clamp(parsed, 1, totalPages);
    setCurrentPage(nextPage);
    setPageInput(String(nextPage));
  }

  function handleZoomIn() {
    setScale((currentScale) => clamp(Number((currentScale + 0.25).toFixed(2)), 0.5, 3));
  }

  function handleZoomOut() {
    setScale((currentScale) => clamp(Number((currentScale - 0.25).toFixed(2)), 0.5, 3));
  }

  function handleSetZoom(nextZoom) {
    setScale(clamp(nextZoom, 0.5, 3));
  }

  async function handleFitToWidth() {
    const pdfDoc = pdfDocRef.current;
    const wrapper = canvasWrapperRef.current;

    if (!pdfDoc || !wrapper) {
      return;
    }

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(wrapper.clientWidth - 32, 200);
      setScale(clamp(availableWidth / viewport.width, 0.5, 3));
    } catch {
      notify.error("Failed to fit PDF to width.");
    }
  }

  async function handleDownload() {
    try {
      const pdfBlob = await createPdfBlob();
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = documentName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify.error("Failed to download the PDF.");
    }
  }

  async function handlePrint() {
    try {
      const pdfBlob = await createPdfBlob();
      const url = URL.createObjectURL(pdfBlob);

      let iframe = document.getElementById("pdf-print-iframe");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "pdf-print-iframe";
        iframe.style.position = "fixed";
        iframe.style.width = "1px";
        iframe.style.height = "1px";
        iframe.style.opacity = "0";
        iframe.style.border = "none";
        iframe.style.left = "-9999px";
        document.body.appendChild(iframe);
      }

      iframe.onload = () => {
        window.setTimeout(() => {
          try {
            const contentWindow = iframe.contentWindow;
            if (!contentWindow) {
              throw new Error("Missing print window.");
            }

            contentWindow.focus();
            contentWindow.onafterprint = () => {
              URL.revokeObjectURL(url);
              iframe.src = "about:blank";
            };
            contentWindow.print();
          } catch {
            URL.revokeObjectURL(url);
            notify.error("Failed to print the PDF.");
          }
        }, 500);
      };

      iframe.src = url;
    } catch {
      notify.error("Failed to prepare the PDF for printing.");
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-5.5rem)] flex-col bg-[#f4f7fa]">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="erp-back-button"
              title="Back"
            >
              <i className="fas fa-arrow-left text-[12px]" />
            </button>
            <div>
              <div className="erp-page-title">{title}</div>
              <div className="erp-page-description">{subtitle || "PDF document preview"}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || Boolean(error)}
              className="erp-header-secondary-button disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className="fas fa-print mr-1.5" />
              Print
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={loading || Boolean(error)}
              className="erp-header-primary-button disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className="fas fa-download mr-1.5" />
              Download
            </button>
          </div>
        </div>

        {!loading && !error && totalPages > 0 ? (
          <div className="border-t border-[#dbe6ee] bg-[#f8fbfd] px-4 py-2">
            <div className="mx-auto flex max-w-5xl flex-col gap-2 text-[11px] text-[#607d8b] md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePreviousPage}
                  disabled={currentPage <= 1}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[#d3dee7] bg-white text-[#1a3557] transition hover:bg-[#eef5fa] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="fas fa-chevron-left text-[10px]" />
                </button>

                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={pageInput}
                  onChange={(event) => setPageInput(event.target.value)}
                  onBlur={handleCommitPageInput}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleCommitPageInput();
                    }
                  }}
                  className="h-7 w-14 rounded-sm border border-[#d3dee7] bg-white px-2 text-center text-[11px] text-[#1a3557] outline-none"
                />
                <span>/ {totalPages}</span>

                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[#d3dee7] bg-white text-[#1a3557] transition hover:bg-[#eef5fa] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="fas fa-chevron-right text-[10px]" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={scale <= 0.5}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[#d3dee7] bg-white text-[#1a3557] transition hover:bg-[#eef5fa] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="fas fa-minus text-[10px]" />
                </button>

                <span className="min-w-[52px] text-center font-medium text-[#1a3557]">
                  {Math.round(scale * 100)}%
                </span>

                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={scale >= 3}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[#d3dee7] bg-white text-[#1a3557] transition hover:bg-[#eef5fa] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="fas fa-plus text-[10px]" />
                </button>

                <div className="mx-1 h-4 w-px bg-[#d3dee7]" />

                <button
                  type="button"
                  onClick={() => handleSetZoom(1)}
                  className="rounded-sm border border-[#d3dee7] bg-white px-2 py-1 font-medium text-[#1a3557] transition hover:bg-[#eef5fa]"
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={handleFitToWidth}
                  className="rounded-sm border border-[#d3dee7] bg-white px-2 py-1 font-medium text-[#1a3557] transition hover:bg-[#eef5fa]"
                >
                  Fit
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="flex flex-1 overflow-hidden rounded-sm border border-[#cfdce7] bg-[#eef5fa] shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#d3dee7] border-t-[#0070b8]" />
              <p className="mt-3 text-[12px] text-[#607d8b]">Loading PDF...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center px-6 py-10">
            <div className="max-w-md text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff1f1] text-[#c62828]">
                <i className="fas fa-triangle-exclamation text-[20px]" />
              </div>
              <h2 className="mt-4 text-[16px] font-bold text-[#1a3557]">Unable to load PDF</h2>
              <p className="mt-2 text-[12px] text-[#607d8b]">{error}</p>
            </div>
          </div>
        ) : (
          <div ref={canvasWrapperRef} className="flex flex-1 justify-center overflow-auto p-4">
            <div className="rounded-sm bg-white p-2 shadow-[0_14px_34px_rgba(15,23,42,0.12)]">
              <canvas ref={canvasRef} className="block max-w-full" />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

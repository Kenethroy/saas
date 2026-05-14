import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "#shared/logger/index";

const COMPANY = {
  name: "JRSPC Hardware Enterprise",
  address: "Bacolod City, Philippines",
  phone: "+63 9318581575",
  email: "admin@jrspc.local"
};

const PDF_DEFAULT_MARGIN = {
  top: "0mm",
  bottom: "0mm",
  left: "0mm",
  right: "0mm"
};

const STATUS_LABELS = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  converted: "Converted"
};

const STATUS_CLASS_NAMES = {
  draft: "status-draft",
  sent: "status-sent",
  accepted: "status-accepted",
  rejected: "status-rejected",
  expired: "status-expired",
  converted: "status-converted"
};

let pdfBrowserPromise;

function resolveAssetPath(...segments) {
  const fromCwd = path.join(process.cwd(), ...segments);
  if (fs.existsSync(fromCwd)) return fromCwd;

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const nodeApiRoot = path.resolve(currentDir, "../../..");
  return path.join(nodeApiRoot, ...segments);
}

function resolveSystemLogoAsBase64() {
  const logoPath = resolveAssetPath("assets", "systems", "logo.png");
  if (fs.existsSync(logoPath)) {
    const bitmap = fs.readFileSync(logoPath);
    return `data:image/png;base64,${bitmap.toString("base64")}`;
  }
  return null;
}

const SYSTEM_LOGO_BASE64 = resolveSystemLogoAsBase64();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(value) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(value) {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  }).format(date);
}

function formatDiscountLabel(quotation) {
  if (!Number(quotation.discountAmount ?? 0)) return "None";
  if (quotation.discountType === "percentage") {
    return `${Number(quotation.discountValue ?? 0)}%`;
  }
  return `Php ${formatMoney(quotation.discountValue)}`;
}

function formatStatus(status) {
  return STATUS_LABELS[status] || "Draft";
}

function buildLine(primary, secondary) {
  if (!primary && !secondary) return "";
  if (!secondary) return `<p class="info-text">${escapeHtml(primary)}</p>`;

  return `<p class="info-text">${escapeHtml(primary)}<br><span class="muted">${escapeHtml(secondary)}</span></p>`;
}

function generateQuotationHtml(quotation) {
  const logoBlock = SYSTEM_LOGO_BASE64
    ? `<img src="${SYSTEM_LOGO_BASE64}" alt="Logo" style="width:44px;height:44px;object-fit:contain;border-radius:6px;display:block;">`
    : `<div style="width:44px;height:44px;border-radius:6px;background:#f0f0ee;border:0.5px solid #d0d0cc;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#333;">JR</div>`;

  const customerName = quotation.customer?.name || "N/A";
  const customerCompany = quotation.customer?.company || "";
  const customerAddress = quotation.customer?.address || "N/A";
  const customerPhone = quotation.customer?.phone || "N/A";
  const customerEmail = quotation.customer?.email || "";
  const contactPerson = quotation.contactPerson || "";
  const paymentTerm = quotation.paymentTerm?.name
    ? `${quotation.paymentTerm.name}${quotation.paymentTerm.days ? ` (${quotation.paymentTerm.days} days)` : ""}`
    : "N/A";
  const agentName = [quotation.agent?.firstName, quotation.agent?.lastName].filter(Boolean).join(" ").trim() || "N/A";
  const convertedOrder = quotation.salesOrder?.salesOrderNumber || "Not converted";
  const notes = quotation.notes?.trim() || "No notes provided.";
  const subtotal = Number(quotation.itemsSubtotal ?? 0);
  const discountAmount = Number(quotation.discountAmount ?? 0);
  const totalAmount = Number(quotation.totalAmount ?? 0);
  const statusClassName = STATUS_CLASS_NAMES[quotation.status] || STATUS_CLASS_NAMES.draft;

  const itemsHtml = (quotation.items?.length ? quotation.items : [{}]).map((item, itemIndex) => {
    const rowBg = itemIndex % 2 === 0 ? "#ffffff" : "#fafaf8";
    const descriptionHtml = item.description
      ? `<div class="item-note">${escapeHtml(item.description)}</div>`
      : "";

    return `
      <tr style="background:${rowBg};border-bottom:0.5px solid #eee;">
        <td style="padding:8px 8px 8px 0;">
          <div class="item-name">${escapeHtml(item.productName || "N/A")}${item.variantName ? ` (${escapeHtml(item.variantName)})` : ""}</div>
          ${descriptionHtml}
        </td>
        <td style="padding:8px;text-align:center;">${escapeHtml(item.quantity ?? 0)}</td>
        <td style="padding:8px;text-align:right;">${formatMoney(item.unitPrice)}</td>
        <td style="padding:8px;text-align:right;">${formatMoney(item.lineDiscount)}</td>
        <td style="padding:8px 0 8px 8px;text-align:right;">${formatMoney(item.lineTotal)}</td>
      </tr>`;
  }).join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      font-size: 9px;
      color: #222;
      line-height: 1.5;
      background: #fff;
    }

    .page {
      padding: 0 0 26px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20px 0 18px;
      margin: 0 28px;
      border-bottom: 1.5px solid #111;
      gap: 16px;
    }

    .company-block {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .company-name {
      font-size: 12px;
      font-weight: 700;
      color: #111;
      letter-spacing: 0.1px;
      margin-bottom: 2px;
    }

    .company-meta {
      font-size: 9px;
      color: #777;
      margin-top: 1px;
    }

    .doc-block {
      text-align: right;
    }

    .doc-label {
      font-size: 16px;
      font-weight: 700;
      color: #111;
      letter-spacing: 1.5px;
    }

    .doc-number {
      font-size: 9px;
      font-weight: 600;
      color: #555;
      margin-top: 4px;
    }

    .doc-date {
      font-size: 9px;
      color: #888;
      margin-top: 1px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 74px;
      margin-top: 8px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.7px;
      text-transform: uppercase;
      border: 0.5px solid transparent;
    }

    .status-draft { background: #f5f5f5; color: #616161; border-color: #d6d6d6; }
    .status-sent { background: #eef5ff; color: #215d9c; border-color: #c7daf5; }
    .status-accepted { background: #edf8f1; color: #237447; border-color: #c6e6d3; }
    .status-rejected { background: #fff0f0; color: #b74242; border-color: #f2c9c9; }
    .status-expired { background: #f8f1ea; color: #8a5a2b; border-color: #ebd5bf; }
    .status-converted { background: #f3efff; color: #5b45a7; border-color: #d7cdf9; }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 0.5px solid #e0e0dc;
    }

    .info-section {
      padding: 14px 28px;
    }

    .info-border-right {
      border-right: 0.5px solid #e0e0dc;
    }

    .section-label {
      font-size: 8px;
      font-weight: 700;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }

    .info-name {
      font-size: 10px;
      font-weight: 700;
      color: #111;
      margin-bottom: 2px;
    }

    .info-text {
      font-size: 9px;
      color: #666;
      margin-top: 2px;
    }

    .info-row {
      font-size: 9px;
      color: #444;
      margin-top: 2px;
    }

    .info-key {
      display: inline-block;
      width: 88px;
      color: #888;
    }

    .muted {
      color: #8c8c8c;
    }

    .table-wrap {
      padding: 0 28px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead tr {
      border-bottom: 1.5px solid #111;
    }

    th {
      padding: 10px 8px 8px;
      font-size: 8px;
      font-weight: 700;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      background: #fff;
    }

    .th-left { text-align: left; padding-left: 0; }
    .th-center { text-align: center; }
    .th-right { text-align: right; }
    .th-last { padding-right: 0; }

    td {
      font-size: 9px;
      color: #222;
      vertical-align: top;
    }

    .item-name {
      font-weight: 600;
      color: #222;
    }

    .item-note {
      margin-top: 2px;
      color: #777;
      font-size: 8px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      padding: 14px 28px 0;
    }

    .notes-box {
      flex: 1;
      border: 0.5px solid #e3e3df;
      background: #fafaf8;
      border-radius: 8px;
      padding: 10px 12px;
      min-height: 86px;
    }

    .notes-title {
      font-size: 8px;
      font-weight: 700;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 5px;
    }

    .notes-text {
      font-size: 9px;
      color: #555;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .totals-card {
      width: 220px;
      flex-shrink: 0;
    }

    .totals-box {
      border-top: 1.5px solid #111;
      padding-top: 8px;
    }

    .total-line {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-top: 5px;
      font-size: 9px;
      color: #555;
    }

    .total-line:first-child {
      margin-top: 0;
    }

    .total-label {
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-size: 8px;
      font-weight: 700;
    }

    .grand-total {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 0.5px solid #ddd;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 16px;
    }

    .grand-total .total-label {
      color: #666;
    }

    .grand-total .total-value {
      font-size: 14px;
      font-weight: 700;
      color: #111;
    }

    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin: 44px 28px 0;
    }

    .signature-box {
      border-top: 0.5px solid #bbb;
      padding-top: 6px;
      text-align: center;
    }

    .sig-title {
      font-size: 9px;
      font-weight: 700;
      color: #333;
    }

    .sig-name {
      display: block;
      margin-top: 2px;
      font-size: 8px;
      color: #777;
    }

    .sig-sub {
      display: block;
      margin-top: 3px;
      font-size: 8px;
      color: #aaa;
    }

    .footer {
      text-align: center;
      font-size: 8px;
      color: #bbb;
      border-top: 0.5px solid #e8e8e4;
      padding-top: 10px;
      margin: 20px 28px 0;
    }
  </style>
</head>
<body>
  <section class="page">
    <div class="header">
      <div class="company-block">
        ${logoBlock}
        <div>
          <p class="company-name">${escapeHtml(COMPANY.name)}</p>
          <p class="company-meta">${escapeHtml(COMPANY.address)}</p>
          <p class="company-meta">${escapeHtml(COMPANY.phone)} &nbsp;&middot;&nbsp; ${escapeHtml(COMPANY.email)}</p>
        </div>
      </div>
      <div class="doc-block">
        <p class="doc-label">QUOTATION</p>
        <p class="doc-number">No: ${escapeHtml(quotation.quoteNumber || "N/A")}</p>
        <p class="doc-date">Date: ${escapeHtml(formatDate(quotation.quoteDate))}</p>
        <span class="status-badge ${statusClassName}">${escapeHtml(formatStatus(quotation.status))}</span>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-section info-border-right">
        <p class="section-label">Quote For</p>
        <p class="info-name">${escapeHtml(customerName)}</p>
        ${customerCompany ? `<p class="info-text">${escapeHtml(customerCompany)}</p>` : ""}
        <p class="info-text">${escapeHtml(customerAddress)}</p>
        ${buildLine(customerPhone, customerEmail)}
        ${contactPerson ? `<p class="info-text"><span class="muted">Contact Person:</span> ${escapeHtml(contactPerson)}</p>` : ""}
      </div>
      <div class="info-section">
        <p class="section-label">Quotation Details</p>
        <p class="info-row"><span class="info-key">Valid Until</span>${escapeHtml(formatDate(quotation.validUntil))}</p>
        <p class="info-row"><span class="info-key">Payment Term</span>${escapeHtml(paymentTerm)}</p>
        <p class="info-row"><span class="info-key">Sales Agent</span>${escapeHtml(agentName)}</p>
        <p class="info-row"><span class="info-key">Sales Order</span>${escapeHtml(convertedOrder)}</p>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="th-left">Product Description</th>
            <th class="th-center">Qty</th>
            <th class="th-right">Unit Price</th>
            <th class="th-right">Discount</th>
            <th class="th-right th-last">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
    </div>

    <div class="summary-row">
      <div class="notes-box">
        <p class="notes-title">Notes</p>
        <p class="notes-text">${escapeHtml(notes)}</p>
      </div>
      <div class="totals-card">
        <div class="totals-box">
          <div class="total-line">
            <span class="total-label">Subtotal</span>
            <span>${formatMoney(subtotal)}</span>
          </div>
          <div class="total-line">
            <span class="total-label">Discount</span>
            <span>${formatMoney(discountAmount)}${discountAmount > 0 ? ` <span class="muted">(${escapeHtml(formatDiscountLabel(quotation))})</span>` : ""}</span>
          </div>
          <div class="grand-total">
            <span class="total-label">Total Amount</span>
            <span class="total-value">Php ${formatMoney(totalAmount)}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="signature-section">
      <div class="signature-box">
        <p class="sig-title">Prepared By</p>
        <span class="sig-name">${escapeHtml(agentName)}</span>
        <span class="sig-sub">Signature Over Printed Name / Date</span>
      </div>
      <div class="signature-box">
        <p class="sig-title">Accepted By</p>
        <span class="sig-name">${escapeHtml(customerName)}</span>
        <span class="sig-sub">Signature Over Printed Name / Date</span>
      </div>
    </div>

    <div class="footer">This is a system-generated quotation.</div>
  </section>
</body>
</html>`;
}

function registerBrowserShutdown() {
  if (registerBrowserShutdown.registered) return;
  registerBrowserShutdown.registered = true;

  const closeBrowser = async () => {
    const currentBrowserPromise = pdfBrowserPromise;
    pdfBrowserPromise = null;

    if (!currentBrowserPromise) return;

    try {
      const browser = await currentBrowserPromise;
      await browser.close();
    } catch {
      // Ignore shutdown errors from already-closed browser instances.
    }
  };

  for (const signal of ["SIGINT", "SIGTERM", "beforeExit"]) {
    process.once(signal, () => {
      void closeBrowser();
    });
  }
}

async function getPdfBrowser() {
  registerBrowserShutdown();

  if (!pdfBrowserPromise) {
    logger.info({
      module: "quotations",
      document: "quotation",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? null
    }, "Launching Puppeteer browser for PDF generation");

    pdfBrowserPromise = puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    pdfBrowserPromise.then(() => {
      logger.info({
        module: "quotations",
        document: "quotation"
      }, "Puppeteer browser launched for PDF generation");
    }).catch((error) => {
      logger.error({
        err: error,
        module: "quotations",
        document: "quotation",
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? null
      }, "Puppeteer launch failed for PDF generation");
      pdfBrowserPromise = null;
    });
  }

  return pdfBrowserPromise;
}

export async function createQuotationPdf(quotation) {
  const quotationId = quotation?.id ?? null;
  const quotationNumber = quotation?.quotationNumber ?? quotation?.quotation_number ?? null;
  logger.info({
    module: "quotations",
    document: "quotation",
    quotationId,
    quotationNumber
  }, "Starting quotation PDF generation");

  const browser = await getPdfBrowser();
  const page = await browser.newPage();

  try {
    const html = generateQuotationHtml(quotation);
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMediaType("screen");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: PDF_DEFAULT_MARGIN
    });

    logger.info({
      module: "quotations",
      document: "quotation",
      quotationId,
      quotationNumber,
      bytes: pdfBuffer.length
    }, "Quotation PDF generated successfully");

    return pdfBuffer;
  } catch (error) {
    logger.error({
      err: error,
      module: "quotations",
      document: "quotation",
      quotationId,
      quotationNumber
    }, "Quotation PDF generation failed");
    throw error;
  } finally {
    await page.close();
  }
}

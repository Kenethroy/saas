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

function generateReceiptSectionHtml(delivery, salesOrder, index, totalSections) {
  const logoBlock = SYSTEM_LOGO_BASE64
    ? `<img src="${SYSTEM_LOGO_BASE64}" alt="Logo" style="width:44px;height:44px;object-fit:contain;border-radius:6px;flex-shrink:0;">`
    : `<div style="width:44px;height:44px;border-radius:6px;background:#f0f0ee;border:0.5px solid #d0d0cc;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#333;flex-shrink:0;">JR</div>`;

  const deliveryDate = formatDate(delivery.deliveryDate);
  const items = salesOrder.salesOrder?.items || salesOrder.items || [];

  const itemsHtml = items.map((item, itemIndex) => {
    const rowBg = itemIndex % 2 === 0 ? "#ffffff" : "#fafaf8";
    return `
      <tr style="background:${rowBg};border-bottom:0.5px solid #eee;">
        <td style="padding:8px 8px 8px 0;font-size:9px;color:#222;">${item.productName}${item.variantName ? ` (${item.variantName})` : ""}</td>
        <td style="padding:8px;font-size:9px;color:#222;text-align:center;">${item.quantity}</td>
        <td style="padding:8px;font-size:9px;color:#222;text-align:right;">${formatMoney(item.unitPrice)}</td>
        <td style="padding:8px 0 8px 8px;font-size:9px;color:#222;text-align:right;">${formatMoney(item.lineTotal ?? item.subtotal)}</td>
      </tr>`;
  }).join("");

  const customerName = salesOrder.salesOrder?.customer?.name || salesOrder.customerName || "N/A";
  const customerAddress = salesOrder.salesOrder?.customer?.address || salesOrder.customerAddress || "N/A";
  const customerPhone = salesOrder.salesOrder?.customer?.phone || salesOrder.customerPhone || "N/A";
  const salesOrderNumber = salesOrder.salesOrder?.salesOrderNumber || salesOrder.salesOrderNumber || "N/A";
  const truckPlate = delivery.truck?.plateNumber || delivery.truckPlate || "N/A";
  const truckModel = delivery.truck?.model || delivery.truckModel || "N/A";
  const driverName = delivery.driverName || (delivery.driver ? `${delivery.driver.firstName} ${delivery.driver.lastName}` : "N/A");
  const totalAmount = salesOrder.salesOrder?.totalAmount ?? salesOrder.totalAmount;

  return `
  <section class="receipt-page${index < totalSections - 1 ? " receipt-page-break" : ""}">
    <div class="container">

      <div class="header">
        <div class="company-block">
          ${logoBlock}
          <div class="company-text">
            <p class="company-name">${COMPANY.name}</p>
            <p class="company-meta">${COMPANY.address}</p>
            <p class="company-meta">${COMPANY.phone} &nbsp;&middot;&nbsp; ${COMPANY.email}</p>
          </div>
        </div>
        <div class="receipt-title">
          <p class="doc-label">DELIVERY RECEIPT</p>
          <p class="doc-number">No: ${delivery.deliveryNumber}</p>
          <p class="doc-date">Date: ${deliveryDate}</p>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-section info-border-right">
          <p class="section-label">Deliver To</p>
          <p class="info-name">${customerName}</p>
          <p class="info-text">${customerAddress}</p>
          <p class="info-text">${customerPhone}</p>
        </div>
        <div class="info-section">
          <p class="section-label">Delivery Details</p>
          <p class="info-row"><span class="info-key">Sales Order</span>${salesOrderNumber}</p>
          <p class="info-row"><span class="info-key">Truck</span>${truckPlate} (${truckModel})</p>
          <p class="info-row"><span class="info-key">Driver</span>${driverName}</p>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="th-left">Product Description</th>
              <th class="th-center">Qty</th>
              <th class="th-right">Unit Price</th>
              <th class="th-right th-last">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>

      <div class="totals-row">
        <div class="totals-box">
          <span class="totals-label">Total Amount</span>
          <span class="totals-value">&#8369; ${formatMoney(totalAmount)}</span>
        </div>
      </div>

      <div class="signature-section">
        <div class="signature-box">
          <p class="sig-title">Delivered By</p>
          <span class="sig-sub">Signature Over Printed Name / Date</span>
        </div>
        <div class="signature-box">
          <p class="sig-title">Received By</p>
          <span class="sig-sub">Signature Over Printed Name / Date</span>
        </div>
      </div>

      <div class="footer">This is a system-generated delivery receipt.</div>
    </div>
  </section>`;
}

function generateReceiptHtml(delivery, salesOrders) {
  const sections = (salesOrders?.length ? salesOrders : [{}])
    .map((salesOrder, index, orders) =>
      generateReceiptSectionHtml(delivery, salesOrder, index, orders.length)
    )
    .join("");

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

    .container { padding: 0 0 28px; }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20px 0 18px;
      margin: 0 28px;
      border-bottom: 1.5px solid #111;
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

    .receipt-title { text-align: right; }

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

    /* ── Info grid ── */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 0.5px solid #e0e0dc;
    }

    .info-section { padding: 14px 28px; }

    .info-border-right { border-right: 0.5px solid #e0e0dc; }

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
      width: 72px;
      color: #888;
    }

    /* ── Items table ── */
    .table-wrap { padding: 0 28px; }

    table { width: 100%; border-collapse: collapse; }

    thead tr { border-bottom: 1.5px solid #111; }

    th {
      padding: 10px 8px 8px;
      font-size: 8px;
      font-weight: 700;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      background: #fff;
    }

    .th-left   { text-align: left; padding-left: 0; }
    .th-center { text-align: center; }
    .th-right  { text-align: right; }
    .th-last   { padding-right: 0; }

    td { color: #222; vertical-align: middle; }

    /* ── Totals ── */
    .totals-row {
      display: flex;
      justify-content: flex-end;
      padding: 12px 28px 0;
    }

    .totals-box {
      border-top: 1.5px solid #111;
      padding-top: 8px;
      min-width: 200px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 24px;
    }

    .totals-label {
      font-size: 8px;
      font-weight: 700;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    .totals-value {
      font-size: 14px;
      font-weight: 700;
      color: #111;
    }

    /* ── Signatures ── */
    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin: 50px 28px 0;
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

    .sig-sub {
      font-size: 8px;
      color: #aaa;
      margin-top: 3px;
      display: block;
    }

    /* ── Footer ── */
    .footer {
      text-align: center;
      font-size: 8px;
      color: #bbb;
      border-top: 0.5px solid #e8e8e4;
      padding-top: 10px;
      margin: 20px 28px 0;
    }

    /* ── Page breaks ── */
    .receipt-page { page-break-after: auto; }
    .receipt-page-break { page-break-after: always; }
  </style>
</head>
<body>
  ${sections}
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
      module: "deliveries",
      document: "delivery-receipt",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? null
    }, "Launching Puppeteer browser for PDF generation");

    pdfBrowserPromise = puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    pdfBrowserPromise.then(() => {
      logger.info({
        module: "deliveries",
        document: "delivery-receipt"
      }, "Puppeteer browser launched for PDF generation");
    }).catch((error) => {
      logger.error({
        err: error,
        module: "deliveries",
        document: "delivery-receipt",
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? null
      }, "Puppeteer launch failed for PDF generation");
      pdfBrowserPromise = null;
    });
  }

  return pdfBrowserPromise;
}

export async function createDeliveryReceiptPdf(delivery, salesOrders) {
  const deliveryId = delivery?.id ?? null;
  const deliveryNumber = delivery?.deliveryNumber ?? delivery?.delivery_number ?? null;
  logger.info({
    module: "deliveries",
    document: "delivery-receipt",
    deliveryId,
    deliveryNumber,
    salesOrderCount: Array.isArray(salesOrders) ? salesOrders.length : 0
  }, "Starting delivery receipt PDF generation");

  const browser = await getPdfBrowser();
  const page = await browser.newPage();

  try {
    const combinedHtml = generateReceiptHtml(delivery, salesOrders);
    await page.setContent(combinedHtml, { waitUntil: "load" });
    await page.emulateMediaType("screen");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: PDF_DEFAULT_MARGIN
    });

    logger.info({
      module: "deliveries",
      document: "delivery-receipt",
      deliveryId,
      deliveryNumber,
      bytes: pdfBuffer.length
    }, "Delivery receipt PDF generated successfully");

    return pdfBuffer;
  } catch (error) {
    logger.error({
      err: error,
      module: "deliveries",
      document: "delivery-receipt",
      deliveryId,
      deliveryNumber
    }, "Delivery receipt PDF generation failed");
    throw error;
  } finally {
    await page.close();
  }
}

import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "#shared/logger/index";

const COMPANY = {
  name: "JRSPC Hardware Enterprise",
  address: "Bacolod City, Philippines",
  phone: "+63 9318581575",
  email: "Jrspchardentco@gmail.com"
};

let pdfBrowserPromise;

function resolveAssetPath(...segments) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(currentDir, "../../../");
  return path.join(projectRoot, ...segments);
}

function resolveSystemLogoAsBase64() {
  const logoPath = resolveAssetPath("assets", "systems", "logo.png");
  if (fs.existsSync(logoPath)) {
    const bitmap = fs.readFileSync(logoPath);
    return `data:image/png;base64,${bitmap.toString("base64")}`;
  }
  return null;
}

function formatMoney(value) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(amount) ? amount : 0);
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusLabel(status) {
  return String(status ?? "N/A")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function generatePurchaseOrderHtml(purchaseOrder) {
  const logoBase64 = resolveSystemLogoAsBase64();
  const logoImg = logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="height:50px;">` : "";
  const supplier = purchaseOrder?.supplier ?? {};
  const paymentTerm = purchaseOrder?.paymentTerm ?? null;
  const items = purchaseOrder?.items ?? [];

  const itemsHtml = items
    .map((item, index) => {
      const description = `${escapeHtml(item.productName)}${item.variantName ? ` (${escapeHtml(item.variantName)})` : ""}`;
      return `
        <tr>
          <td style="text-align:center;">${String(index + 1).padStart(3, "0")}</td>
          <td><div class="product-name">${description}</div></td>
          <td style="text-align:center;">${escapeHtml(item.quantity)}</td>
          <td style="text-align:right;">${formatMoney(item.unitCost)}</td>
          <td style="text-align:right;font-weight:bold;">${formatMoney(item.lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #333; line-height: 1.5; background: #fff; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  .container { padding: 30px; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1a3557; padding-bottom: 15px; margin-bottom: 20px; }
  .company-info h1 { font-size: 20px; color: #1a3557; margin-bottom: 5px; }
  .company-info p { color: #666; font-size: 10px; }
  .po-meta { text-align: right; }
  .po-meta h2 { font-size: 24px; color: #0070b8; margin-bottom: 5px; letter-spacing: 1px; }
  .meta-grid { display: grid; grid-template-columns: auto auto; gap: 5px 15px; text-align: left; }
  .meta-label { font-weight: bold; color: #546e7a; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .info-box h3 { font-size: 12px; color: #1a3557; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px; text-transform: uppercase; }
  .info-box p { margin-bottom: 3px; }
  .lead-name { font-weight: bold; font-size: 13px; color: #212121; }
  .items-table { margin-bottom: 24px; }
  .items-table th { background: #f8fafc; color: #1a3557; font-weight: bold; text-transform: uppercase; font-size: 10px; padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: left; }
  .items-table td { padding: 10px; border-bottom: 1px solid #edf2f7; vertical-align: top; }
  .product-name { font-weight: 600; color: #2d3748; }
  .totals-wrapper { display: flex; justify-content: flex-end; }
  .totals-table { width: 320px; }
  .totals-table tr td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
  .grand-total-row { background: #eef5fa; }
  .grand-total-label { font-size: 13px; font-weight: bold; color: #1a3557; padding: 12px 10px !important; }
  .grand-total-value { font-size: 16px; font-weight: bold; color: #1a3557; text-align: right; padding: 12px 10px !important; }
  .notes { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  .notes h3 { font-size: 11px; color: #1a3557; margin-bottom: 8px; text-transform: uppercase; }
  .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 9px; border-top: 1px solid #eee; padding-top: 15px; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-info">
        ${logoImg}
        <h1>${escapeHtml(COMPANY.name)}</h1>
        <p>${escapeHtml(COMPANY.address)}</p>
        <p>${escapeHtml(COMPANY.phone)} | ${escapeHtml(COMPANY.email)}</p>
      </div>
      <div class="po-meta">
        <h2>PURCHASE ORDER</h2>
        <div class="meta-grid">
          <div class="meta-label">PO No.</div><div>${escapeHtml(purchaseOrder?.poNumber ?? "N/A")}</div>
          <div class="meta-label">Status</div><div>${escapeHtml(statusLabel(purchaseOrder?.status))}</div>
          <div class="meta-label">Order Date</div><div>${escapeHtml(formatDate(purchaseOrder?.orderDate))}</div>
          <div class="meta-label">Expected</div><div>${escapeHtml(formatDate(purchaseOrder?.expectedDate))}</div>
        </div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <h3>Supplier</h3>
        <p class="lead-name">${escapeHtml(supplier?.name ?? "N/A")}</p>
        <p>${escapeHtml(supplier?.companyName ?? "")}</p>
        <p>${escapeHtml(supplier?.phone ?? "")}</p>
        <p>${escapeHtml(supplier?.email ?? "")}</p>
        <p>${escapeHtml(supplier?.address ?? "")}</p>
      </div>
      <div class="info-box">
        <h3>Order Details</h3>
        <p><strong>Payment Term:</strong> ${escapeHtml(paymentTerm ? `${paymentTerm.name}${paymentTerm.days ? ` (${paymentTerm.days} days)` : ""}` : "Cash / None")}</p>
        <p><strong>Items Subtotal:</strong> PHP ${formatMoney(purchaseOrder?.itemsSubtotal)}</p>
        <p><strong>Received Total:</strong> ${purchaseOrder?.receivedTotal != null ? `PHP ${formatMoney(purchaseOrder.receivedTotal)}` : "N/A"}</p>
        <p><strong>Received At:</strong> ${escapeHtml(formatDate(purchaseOrder?.receivedAt))}</p>
      </div>
    </div>

    <div class="items-table">
      <table>
        <thead>
          <tr>
            <th style="width:60px;">#</th>
            <th>Item</th>
            <th style="width:80px;text-align:center;">Qty</th>
            <th style="width:110px;text-align:right;">Unit Cost</th>
            <th style="width:120px;text-align:right;">Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml || `<tr><td colspan="5" style="padding:18px;text-align:center;color:#64748b;">No line items found.</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="totals-wrapper">
      <table class="totals-table">
        <tr>
          <td class="meta-label">Items Subtotal</td>
          <td style="text-align:right;">PHP ${formatMoney(purchaseOrder?.itemsSubtotal)}</td>
        </tr>
        <tr class="grand-total-row">
          <td class="grand-total-label">Total Amount</td>
          <td class="grand-total-value">PHP ${formatMoney(purchaseOrder?.totalAmount)}</td>
        </tr>
      </table>
    </div>

    <div class="notes">
      <h3>Notes</h3>
      <p>${escapeHtml(purchaseOrder?.notes ?? purchaseOrder?.receivedNotes ?? "—")}</p>
    </div>

    <div class="footer">This is a system-generated purchase order.</div>
  </div>
</body>
</html>`;
}

async function getBrowser() {
  if (!pdfBrowserPromise) {
    logger.info({
      module: "purchase-orders",
      document: "purchase-order",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? null
    }, "Launching Puppeteer browser for PDF generation");

    pdfBrowserPromise = puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    pdfBrowserPromise.then(() => {
      logger.info({
        module: "purchase-orders",
        document: "purchase-order"
      }, "Puppeteer browser launched for PDF generation");
    }).catch((error) => {
      logger.error({
        err: error,
        module: "purchase-orders",
        document: "purchase-order",
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? null
      }, "Puppeteer launch failed for PDF generation");
      pdfBrowserPromise = null;
    });
  }

  return pdfBrowserPromise;
}

export async function createPurchaseOrderPdf(purchaseOrder) {
  const purchaseOrderId = purchaseOrder?.id ?? null;
  const poNumber = purchaseOrder?.poNumber ?? purchaseOrder?.po_number ?? null;
  logger.info({
    module: "purchase-orders",
    document: "purchase-order",
    purchaseOrderId,
    poNumber
  }, "Starting purchase order PDF generation");

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    const html = generatePurchaseOrderHtml(purchaseOrder);
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "16mm",
        right: "12mm",
        bottom: "16mm",
        left: "12mm"
      }
    });

    logger.info({
      module: "purchase-orders",
      document: "purchase-order",
      purchaseOrderId,
      poNumber,
      bytes: pdfBuffer.length
    }, "Purchase order PDF generated successfully");

    return pdfBuffer;
  } catch (error) {
    logger.error({
      err: error,
      module: "purchase-orders",
      document: "purchase-order",
      purchaseOrderId,
      poNumber
    }, "Purchase order PDF generation failed");
    throw error;
  } finally {
    await page.close();
  }
}

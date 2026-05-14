import PDFDocument from "pdfkit";
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

const PW = 595.28;
const PH = 841.89;
const PAD = 22;
const CONTENT_W = PW - (PAD * 2);
const PAGE_BOTTOM = PH - PAD;
const CURRENCY_SYMBOL = "\u20b1";

const C = {
  navy: "#1a3557",
  blue: "#0070b8",
  greyText: "#666666",
  greyLabel: "#546e7a",
  greyBorder: "#e2e8f0",
  greyLight: "#edf2f7",
  greyBg: "#f8fafc",
  greyFaint: "#f1f5f9",
  greyFtr: "#94a3b8",
  greyDiv: "#eeeeee",
  grandBg: "#eef5fa",
  red: "#e53e3e",
  black: "#333333",
  prodName: "#2d3748",
  white: "#ffffff"
};

function resolveAssetPath(...segments) {
  const fromCwd = path.join(process.cwd(), ...segments);
  if (fs.existsSync(fromCwd)) return fromCwd;

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(currentDir, "../../../");
  return path.join(projectRoot, ...segments);
}

function resolveExistingAssetPath(...segments) {
  const assetPath = resolveAssetPath(...segments);
  return fs.existsSync(assetPath) ? assetPath : null;
}

const REGULAR_FONT_PATH = resolveExistingAssetPath("assets", "fonts", "NotoSans-Regular.ttf");
const BOLD_FONT_PATH = resolveExistingAssetPath("assets", "fonts", "NotoSans-Bold.ttf");
const LOGO_PATH = resolveExistingAssetPath("assets", "systems", "logo.png");

const FONTS = {
  regular: REGULAR_FONT_PATH ? "NotoSans" : "Helvetica",
  bold: BOLD_FONT_PATH ? "NotoSans-Bold" : "Helvetica-Bold"
};

function registerFonts(doc) {
  if (REGULAR_FONT_PATH) doc.registerFont(FONTS.regular, REGULAR_FONT_PATH);
  if (BOLD_FONT_PATH) doc.registerFont(FONTS.bold, BOLD_FONT_PATH);
}

function formatMoney(value) {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safeAmount);
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

function money(value, { withSymbol = false } = {}) {
  const amount = formatMoney(value);
  return withSymbol ? `${CURRENCY_SYMBOL} ${amount}` : amount;
}

function fillRect(doc, x, y, w, h, color) {
  doc.save().fillColor(color).rect(x, y, w, h).fill().restore();
}

function hLine(doc, x, y, w, color, lineWidth = 0.5) {
  doc.save()
    .strokeColor(color)
    .lineWidth(lineWidth)
    .moveTo(x, y)
    .lineTo(x + w, y)
    .stroke()
    .restore();
}

function drawText(doc, value, x, y, {
  font = FONTS.regular,
  size = 11,
  color = C.black,
  width = CONTENT_W,
  align = "left",
  lineBreak = false,
  cellH = 0,
  characterSpacing = 0
} = {}) {
  const offsetY = cellH > 0 ? Math.max(0, (cellH - (size * 1.2)) / 2) : 0;
  doc.save()
    .font(font)
    .fontSize(size)
    .fillColor(color)
    .text(String(value ?? ""), x, y + offsetY, {
      width,
      align,
      lineBreak,
      ellipsis: true,
      characterSpacing
    })
    .restore();
}

function buildColumns(contentW) {
  const fixed = { line: 44, qty: 52, price: 88, disc: 72, total: 88 };
  const descW = contentW - fixed.line - fixed.qty - fixed.price - fixed.disc - fixed.total;
  return [
    { key: "line", label: "Line", width: fixed.line, align: "center" },
    { key: "desc", label: "Description", width: descW, align: "left" },
    { key: "qty", label: "Qty", width: fixed.qty, align: "center" },
    { key: "price", label: "Unit Price", width: fixed.price, align: "right" },
    { key: "disc", label: "Disc", width: fixed.disc, align: "right" },
    { key: "total", label: "Total", width: fixed.total, align: "right" }
  ];
}

function drawItemsTableHeader(doc, y, columns) {
  const headerHeight = 30;
  fillRect(doc, PAD, y, CONTENT_W, headerHeight, C.greyBg);
  hLine(doc, PAD, y + headerHeight, CONTENT_W, C.greyBorder, 2);

  let currentX = PAD;
  columns.forEach((column) => {
    drawText(doc, column.label.toUpperCase(), currentX + 6, y, {
      font: FONTS.bold,
      size: 8,
      color: C.navy,
      width: column.width - 10,
      align: column.align,
      cellH: headerHeight
    });
    currentX += column.width;
  });

  return y + headerHeight;
}

function addContinuationPage(doc, state, columns) {
  doc.addPage({ size: "A4", margin: 0 });
  state.y = PAD;
  drawText(doc, "SALES INVOICE", PAD, state.y, {
    font: FONTS.bold,
    size: 12,
    color: C.blue,
    width: CONTENT_W,
    align: "right",
    characterSpacing: 0.6
  });
  state.y += 24;
  state.y = drawItemsTableHeader(doc, state.y, columns);
}

function drawMetaRow(doc, label, value, x, y, width) {
  const labelWidth = 74;
  const valueWidth = width - labelWidth;

  drawText(doc, label, x, y, {
    font: FONTS.bold,
    size: 8,
    color: C.greyLabel,
    width: labelWidth - 4,
    align: "left"
  });
  drawText(doc, value, x + labelWidth, y, {
    font: FONTS.regular,
    size: 8,
    color: C.black,
    width: valueWidth,
    align: "right"
  });
}

function drawFooter(doc, y) {
  hLine(doc, PAD, y, CONTENT_W, C.greyDiv, 0.8);
  drawText(doc, "This is a computer-generated document. No signature is required.", PAD, y + 10, {
    font: FONTS.regular,
    size: 9,
    color: C.greyFtr,
    width: CONTENT_W,
    align: "center"
  });
  drawText(doc, `\u00a9 ${new Date().getFullYear()} ${COMPANY.name}. All rights reserved.`, PAD, y + 23, {
    font: FONTS.regular,
    size: 9,
    color: C.greyFtr,
    width: CONTENT_W,
    align: "center"
  });
}

function renderInvoice(doc, invoice) {
  registerFonts(doc);

  const customer = invoice.customer || {};
  const items = invoice.items || [];
  const columns = buildColumns(CONTENT_W);
  const state = { y: PAD };
  const derivedSubtotal = items.length > 0
    ? items.reduce((sum, item) => sum + Number(item.lineTotal ?? 0), 0)
    : Number(invoice.subtotal ?? 0);
  const orderDiscount = Number(invoice.orderDiscount ?? 0);
  const totalAmountDue = Number.isFinite(Number(invoice.grandTotal))
    ? Number(invoice.grandTotal)
    : Math.max(0, derivedSubtotal - orderDiscount);

  const headerHeight = 80;
  let logoEndX = PAD;
  if (LOGO_PATH) {
    doc.image(LOGO_PATH, PAD, state.y + 6, {
      fit: [50, 50],
      align: "left",
      valign: "center"
    });
    logoEndX = PAD + 60;
  }

  drawText(doc, COMPANY.name, logoEndX, state.y + 6, {
    font: FONTS.bold,
    size: 15,
    color: C.navy,
    width: CONTENT_W * 0.5
  });
  drawText(doc, COMPANY.address, logoEndX, state.y + 30, {
    font: FONTS.regular,
    size: 8,
    color: C.greyText,
    width: CONTENT_W * 0.5
  });
  drawText(doc, `Tel: ${COMPANY.phone}  |  Email: ${COMPANY.email}`, logoEndX, state.y + 42, {
    font: FONTS.regular,
    size: 8,
    color: C.greyText,
    width: CONTENT_W * 0.5
  });

  const metaX = PAD + (CONTENT_W * 0.55);
  const metaW = CONTENT_W * 0.45;
  drawText(doc, "SALES INVOICE", metaX, state.y + 6, {
    font: FONTS.bold,
    size: 16,
    color: C.blue,
    width: metaW,
    align: "left",
    characterSpacing: 0.8
  });

  const metaRows = [
    ["Invoice No:", invoice.invoiceNumber ?? invoice.invoice_number ?? "N/A"],
    ["Date:", formatDate(invoice.invoiceDate ?? invoice.invoice_date)],
    ["Order No:", invoice.salesOrderNumber ?? invoice.sales_order_number ?? invoice.salesOrder?.salesOrderNumber ?? "N/A"]
  ];
  let metaY = state.y + 30;
  for (const [label, value] of metaRows) {
    drawMetaRow(doc, label, value, metaX, metaY, metaW);
    metaY += 14;
  }

  state.y += headerHeight - 10;
  hLine(doc, PAD, state.y, CONTENT_W, C.navy, 2);
  state.y += 14;

  const billingHeight = 88;
  const billingColW = (CONTENT_W - 30) / 2;
  const sections = [
    {
      title: "Bill To",
      name: customer.name || "Walk-in Customer",
      lines: [
        customer.company || null,
        customer.address || "N/A",
        `Phone: ${customer.phone || "N/A"}`
      ]
    },
    {
      title: "Ship To",
      name: customer.name || "Walk-in Customer",
      lines: [
        customer.address || "N/A",
        null,
        `Payment Terms: ${invoice.paymentTerm?.name || "N/A"}`,
        `Due Date: ${formatDate(invoice.dueDate ?? invoice.due_date)}`
      ]
    }
  ];

  sections.forEach((section, index) => {
    const sectionX = PAD + (index * (billingColW + 30));
    drawText(doc, section.title.toUpperCase(), sectionX, state.y, {
      font: FONTS.bold,
      size: 9,
      color: C.navy,
      width: billingColW
    });
    hLine(doc, sectionX, state.y + 14, billingColW, C.greyDiv, 0.8);
    drawText(doc, section.name, sectionX, state.y + 18, {
      font: FONTS.bold,
      size: 10,
      color: C.black,
      width: billingColW
    });

    let lineY = state.y + 34;
    section.lines.forEach((line) => {
      if (line === null) {
        lineY += 6;
        return;
      }

      drawText(doc, line, sectionX, lineY, {
        font: FONTS.regular,
        size: 8,
        color: C.greyText,
        width: billingColW
      });
      lineY += 13;
    });
  });

  state.y += billingHeight;
  state.y = drawItemsTableHeader(doc, state.y, columns);

  const rowHeight = 28;
  items.forEach((item, index) => {
    if (state.y + rowHeight > PH - 160) {
      addContinuationPage(doc, state, columns);
    }

    const description = `${item.productName || ""}${item.variantName ? ` (${item.variantName})` : ""}`;
    const rowBg = index % 2 === 0 ? C.white : C.greyFaint;
    fillRect(doc, PAD, state.y, CONTENT_W, rowHeight, rowBg);

    const cells = [
      { value: String(index + 1).padStart(3, "0"), font: FONTS.regular, color: C.black },
      { value: description, font: FONTS.regular, color: C.prodName },
      { value: String(item.quantity ?? 0), font: FONTS.regular, color: C.black },
      { value: money(item.unitPrice), font: FONTS.regular, color: C.black },
      { value: Number(item.lineDiscount ?? 0) > 0 ? money(item.lineDiscount) : "-", font: FONTS.regular, color: Number(item.lineDiscount ?? 0) > 0 ? C.red : C.black },
      { value: money(item.lineTotal), font: FONTS.regular, color: C.black }
    ];

    let currentX = PAD;
    cells.forEach((cell, cellIndex) => {
      drawText(doc, cell.value, currentX + 6, state.y, {
        font: cell.font,
        size: 8,
        color: cell.color,
        width: columns[cellIndex].width - 10,
        align: columns[cellIndex].align,
        cellH: rowHeight
      });
      currentX += columns[cellIndex].width;
    });

    hLine(doc, PAD, state.y + rowHeight, CONTENT_W, C.greyLight, 0.5);
    state.y += rowHeight;
  });

  state.y += 12;

  const totalsWidth = 280;
  const totalsX = PAD + CONTENT_W - totalsWidth;
  const totalRowHeight = 22;
  const grandHeight = 38;
  const totalRows = [
    { label: "Subtotal", value: money(derivedSubtotal), color: C.black },
    { label: "Order Discount", value: `-${money(orderDiscount)}`, color: C.red }
  ];

  const totalsBlockHeight = (totalRows.length * totalRowHeight) + grandHeight + 60;
  if (state.y + totalsBlockHeight > PH - 60) {
    doc.addPage({ size: "A4", margin: 0 });
    state.y = PAD;
  }

  totalRows.forEach((row) => {
    drawText(doc, row.label, totalsX + 8, state.y + 5, {
      font: FONTS.regular,
      size: 8,
      color: C.greyLabel,
      width: totalsWidth * 0.55
    });
    drawText(doc, row.value, totalsX + 8, state.y + 5, {
      font: FONTS.regular,
      size: 8,
      color: row.color,
      width: totalsWidth - 12,
      align: "right"
    });
    hLine(doc, totalsX, state.y + totalRowHeight, totalsWidth, C.greyFaint, 0.5);
    state.y += totalRowHeight;
  });

  fillRect(doc, totalsX, state.y, totalsWidth, grandHeight, C.grandBg);
  drawText(doc, "Total Amount Due", totalsX + 8, state.y, {
    font: FONTS.bold,
    size: 10,
    color: C.navy,
    width: totalsWidth * 0.55,
    cellH: grandHeight
  });
  drawText(doc, money(invoice.grandTotal, { withSymbol: true }), totalsX + 8, state.y, {
    font: FONTS.bold,
    size: 12,
    color: C.navy,
    width: totalsWidth - 12,
    align: "right",
    cellH: grandHeight
  });
  state.y += grandHeight + 40;

  const footerStartY = Math.min(state.y, PAGE_BOTTOM - 34);
  drawFooter(doc, footerStartY);
}

export async function createSalesInvoicePdf(invoice) {
  const invoiceId = invoice?.id ?? null;
  const invoiceNumber = invoice?.invoiceNumber ?? invoice?.invoice_number ?? null;

  return new Promise((resolve, reject) => {
    logger.info({
      module: "sales-orders",
      document: "sales-invoice",
      invoiceId,
      invoiceNumber,
      renderer: "pdfkit",
      logoPath: LOGO_PATH
    }, "Generating sales invoice PDF with PDFKit");

    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      info: {
        Title: `Sales Invoice - ${invoiceNumber ?? ""}`,
        Author: COMPANY.name,
        Subject: "Sales Invoice"
      }
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", (error) => {
      logger.error({
        err: error,
        module: "sales-orders",
        document: "sales-invoice",
        invoiceId,
        invoiceNumber,
        renderer: "pdfkit"
      }, "Sales invoice PDF generation failed");
      reject(error);
    });
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      logger.info({
        module: "sales-orders",
        document: "sales-invoice",
        invoiceId,
        invoiceNumber,
        bytes: pdfBuffer.length,
        renderer: "pdfkit"
      }, "Sales invoice PDF generated successfully");
      resolve(pdfBuffer);
    });

    try {
      renderInvoice(doc, invoice);
      doc.end();
    } catch (error) {
      logger.error({
        err: error,
        module: "sales-orders",
        document: "sales-invoice",
        invoiceId,
        invoiceNumber,
        renderer: "pdfkit"
      }, "Sales invoice PDF generation failed during render");
      reject(error);
    }
  });
}

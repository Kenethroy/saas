import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "#shared/logger/index";

// ─── Company Info (same as SOA) ──────────────────────────────────────────────
const COMPANY = {
  name: "JRSPC Hardware Enterprise",
  address: "Bacolod City, Philippines",
  phone: "+63 9318581575",
  email: "admin@jrspc.local"
};

// ─── Layout Constants ─────────────────────────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 28;
const CONTENT_W = PAGE_W - MARGIN * 2;
const HEADER_H = 64;
const TITLE_H = 40;
const SYS_FTR_H = 20;
const CURRENCY_SYMBOL = "\u20b1";

// ─── Color Palette (same as SOA) ─────────────────────────────────────────────
const C = {
  navy: "#1a3557",
  navyMid: "#2c5f8a",
  navyLight: "#4a7fa8",
  skyLight: "#b3d4f0",
  skyMid: "#90caf9",
  blueBg: "#edf3f9",
  blueBorder: "#b0bec5",
  green: "#2e7d32",
  greenDark: "#1b5e20",
  greenBg: "#e8f5e9",
  red: "#c62828",
  grey100: "#f4f7fb",
  grey200: "#eceff1",
  grey300: "#cfd8dc",
  grey600: "#607d8b",
  grey700: "#546e7a",
  grey800: "#37474f",
  black: "#212121",
  white: "#ffffff"
};

// ─── Asset Resolution ─────────────────────────────────────────────────────────
function resolveAssetPath(...segments) {
  const fromCwd = path.join(process.cwd(), ...segments);
  if (fs.existsSync(fromCwd)) return fromCwd;
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const nodeApiRoot = path.resolve(currentDir, "../../..");
  return path.join(nodeApiRoot, ...segments);
}

function resolveExistingAssetPath(...segments) {
  const p = resolveAssetPath(...segments);
  return fs.existsSync(p) ? p : null;
}

const REGULAR_FONT_PATH = resolveExistingAssetPath("assets", "fonts", "NotoSans-Regular.ttf");
const BOLD_FONT_PATH = resolveExistingAssetPath("assets", "fonts", "NotoSans-Bold.ttf");
const LOGO_PATH = resolveExistingAssetPath("assets", "systems", "logo.png");

const FONTS = {
  regular: REGULAR_FONT_PATH ? "NotoSans" : "Helvetica",
  bold: BOLD_FONT_PATH ? "NotoSans-Bold" : "Helvetica-Bold"
};

// ─── Drawing Primitives ───────────────────────────────────────────────────────
function registerFonts(doc) {
  if (REGULAR_FONT_PATH) doc.registerFont(FONTS.regular, REGULAR_FONT_PATH);
  if (BOLD_FONT_PATH) doc.registerFont(FONTS.bold, BOLD_FONT_PATH);
}

function rect(doc, x, y, w, h, fill, stroke = null, lineWidth = 0) {
  doc.save();
  if (stroke) {
    doc.lineWidth(lineWidth).strokeColor(stroke);
    fill ? doc.rect(x, y, w, h).fillAndStroke(fill, stroke)
         : doc.rect(x, y, w, h).stroke();
  } else {
    doc.fillColor(fill).rect(x, y, w, h).fill();
  }
  doc.restore();
}

function hLine(doc, x, y, w, color = C.grey300, lw = 0.5) {
  doc.save().strokeColor(color).lineWidth(lw).moveTo(x, y).lineTo(x + w, y).stroke().restore();
}

function vLine(doc, x, y, h, color = C.grey300, lw = 0.5) {
  doc.save().strokeColor(color).lineWidth(lw).moveTo(x, y).lineTo(x, y + h).stroke().restore();
}

function drawText(doc, content, x, y, {
  font = FONTS.regular, size = 9, color = C.black,
  width, align = "left", lineBreak = false, characterSpacing = 0
} = {}) {
  doc.save()
    .font(font).fontSize(size).fillColor(color)
    .text(String(content ?? ""), x, y, { width, align, lineBreak, characterSpacing })
    .restore();
}

function formatMoney(value) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(n) ? n : 0);
}

function money(value) {
  return `${CURRENCY_SYMBOL} ${formatMoney(value)}`;
}

function formatDate(value) {
  if (!value) return "N/A";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "2-digit" }).format(d);
}

function formatDateTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "numeric", minute: "2-digit", hour12: true
  }).format(d);
}

// ─── Page Header (same structure as SOA) ─────────────────────────────────────
function drawPageHeader(doc, payslip, printedAt) {
  rect(doc, 0, 0, PAGE_W, HEADER_H, C.white);

  const logoSize = 50;
  const gap = 10;
  const companyTextWidth = 360;
  const groupWidth = logoSize + gap + companyTextWidth;
  const groupX = (PAGE_W - groupWidth) / 2 + 75;
  const logoX = groupX;
  const logoY = 8;
  const headingX = logoX + logoSize + gap;

  if (LOGO_PATH) {
    doc.image(LOGO_PATH, logoX, logoY, { fit: [logoSize, logoSize] });
  }

  const baseY = 13;
  drawText(doc, COMPANY.name, headingX, baseY, {
    font: FONTS.bold, size: 15, color: C.navy, width: companyTextWidth
  });
  drawText(doc, COMPANY.address, headingX, baseY + 20, {
    font: FONTS.regular, size: 8, color: C.grey700, width: companyTextWidth
  });
  drawText(doc, `Tel: ${COMPANY.phone}  •  Email: ${COMPANY.email}`, headingX, baseY + 30, {
    font: FONTS.regular, size: 8, color: C.grey700, width: companyTextWidth
  });

  // Title bar
  rect(doc, MARGIN, HEADER_H, CONTENT_W, TITLE_H, C.navy);
  drawText(doc, "PAYSLIP", MARGIN, HEADER_H + 8, {
    font: FONTS.bold, size: 13, color: C.white, width: CONTENT_W,
    align: "center", characterSpacing: 2
  });
  drawText(doc, "Official Employee Salary Statement — Confidential", MARGIN, HEADER_H + 27, {
    font: FONTS.regular, size: 8, color: C.skyMid, width: CONTENT_W, align: "center"
  });

  // Footer bar
  const footerY = PAGE_H - MARGIN - SYS_FTR_H;
  rect(doc, MARGIN, footerY, CONTENT_W, SYS_FTR_H, C.navy);
  drawText(
    doc,
    `System-generated payslip | ${COMPANY.name} - HR & Payroll | Valid without wet signature.`,
    MARGIN + 8, footerY + 6,
    { font: FONTS.regular, size: 7, color: C.skyMid, width: CONTENT_W * 0.6 }
  );
  drawText(
    doc,
    `Ref: ${payslip.payslip_number} | Printed: ${printedAt}`,
    MARGIN + 8, footerY + 6,
    { font: FONTS.regular, size: 7, color: C.skyMid, width: CONTENT_W - 16, align: "right" }
  );
}

// ─── Employee Info Strip ──────────────────────────────────────────────────────
function drawEmployeeStrip(doc, y, payslip) {
  const blockH = 72;
  rect(doc, MARGIN, y, CONTENT_W, blockH, C.grey100);
  hLine(doc, MARGIN, y + blockH, CONTENT_W, C.grey300, 0.7);

  const col1W = CONTENT_W * 0.55;
  const col2X = MARGIN + col1W;

  drawText(doc, "EMPLOYEE", MARGIN + 8, y + 9, {
    font: FONTS.bold, size: 7, color: C.navyMid, characterSpacing: 0.7
  });
  drawText(doc, payslip.employee_name || `Employee #${payslip.employee_id}`, MARGIN + 8, y + 20, {
    font: FONTS.bold, size: 12, color: C.navy, width: col1W - 16
  });
  drawText(doc, `Employee ID: ${payslip.employee_id}`, MARGIN + 8, y + 38, {
    font: FONTS.regular, size: 8, color: C.grey700, width: col1W - 16
  });
  drawText(doc, `Status: ${String(payslip.status || "draft").toUpperCase()}`, MARGIN + 8, y + 50, {
    font: FONTS.bold, size: 8,
    color: payslip.status === "released" ? C.green : C.grey700,
    width: col1W - 16
  });

  vLine(doc, col2X, y + 6, blockH - 12, C.grey300, 0.7);

  drawText(doc, "PAYSLIP DETAILS", col2X + 10, y + 9, {
    font: FONTS.bold, size: 7, color: C.navyMid, characterSpacing: 0.7
  });

  const details = [
    ["Payslip No.:", payslip.payslip_number],
    ["Pay Date:", formatDate(payslip.pay_date)],
    ["Period:", `${formatDate(payslip.period_start)} – ${formatDate(payslip.period_end)}`]
  ];

  let detailY = y + 21;
  const labelW = 75;
  const valueX = col2X + 10 + labelW;
  const valueW = CONTENT_W - col1W - labelW - 18;

  for (const [label, value] of details) {
    drawText(doc, label, col2X + 10, detailY, {
      font: FONTS.bold, size: 8, color: C.grey800, width: labelW
    });
    drawText(doc, value, valueX, detailY, {
      font: FONTS.regular, size: 8, color: C.grey700, width: valueW
    });
    detailY += 13;
  }

  return y + blockH;
}

// ─── Earnings / Deductions Table ──────────────────────────────────────────────
function drawBreakdownTable(doc, y, payslip) {
  const tableGap = 12;
  y += tableGap;

  const sectionH = 18;
  rect(doc, MARGIN, y, CONTENT_W, sectionH, C.navyMid);
  drawText(doc, "EARNINGS & DEDUCTIONS", MARGIN + 8, y + 5, {
    font: FONTS.bold, size: 8, color: C.skyLight, characterSpacing: 0.7
  });
  y += sectionH;

  // Table header
  const rowH = 18;
  const col1X = MARGIN;
  const col2X = MARGIN + CONTENT_W * 0.55;
  const col3X = MARGIN + CONTENT_W * 0.78;
  const descW = CONTENT_W * 0.53;
  const typeW = CONTENT_W * 0.21;
  const amtW = CONTENT_W * 0.22;

  rect(doc, MARGIN, y, CONTENT_W, rowH, C.navy);
  drawText(doc, "DESCRIPTION", col1X + 6, y + 5, {
    font: FONTS.bold, size: 7.5, color: C.white, width: descW
  });
  drawText(doc, "TYPE", col2X + 6, y + 5, {
    font: FONTS.bold, size: 7.5, color: C.white, width: typeW
  });
  drawText(doc, "AMOUNT", col3X + 6, y + 5, {
    font: FONTS.bold, size: 7.5, color: C.white, width: amtW - 10, align: "right"
  });
  y += rowH;

  const meta = payslip?.metadata ?? {};

  const rows = [
    { description: "Basic Pay", type: "Earnings", amount: Number(meta.basic_pay ?? 0), isDeduction: false }
  ];

  const overtimePay = Number(payslip?.overtime_pay ?? 0);
  if (overtimePay > 0) {
    rows.push({ description: "Overtime Pay", type: "Earnings", amount: overtimePay, isDeduction: false });
  }

  rows.push(
    { description: "Allowances", type: "Earnings", amount: Number(meta.allowances ?? 0), isDeduction: false },
    { description: "Deductions", type: "Deductions", amount: Number(meta.deductions ?? 0), isDeduction: true }
  );

  rows.forEach((row, index) => {
    const bg = index % 2 === 0 ? C.white : C.grey100;
    rect(doc, MARGIN, y, CONTENT_W, rowH, bg);

    drawText(doc, row.description, col1X + 6, y + 5, {
      font: FONTS.bold, size: 8.5, color: C.black, width: descW
    });
    drawText(doc, row.type, col2X + 6, y + 5, {
      font: FONTS.regular, size: 8, color: row.isDeduction ? C.red : C.green, width: typeW
    });

    const displayAmount = row.isDeduction
      ? `(${CURRENCY_SYMBOL} ${formatMoney(row.amount)})`
      : money(row.amount);
    drawText(doc, displayAmount, col3X + 6, y + 5, {
      font: FONTS.bold, size: 8.5, color: row.isDeduction ? C.red : C.black,
      width: amtW - 10, align: "right"
    });

    hLine(doc, MARGIN, y + rowH, CONTENT_W, C.grey200, 0.5);
    y += rowH;
  });

  hLine(doc, MARGIN, y, CONTENT_W, C.navy, 1.5);
  return y;
}

// ─── Summary Boxes (Gross / Deductions / Net) ─────────────────────────────────
function drawSummaryBoxes(doc, y, payslip) {
  const gap = 12;
  y += gap;

  const boxes = [
    { label: "GROSS PAY", value: money(payslip.gross_pay), bg: C.grey100, textColor: C.navy, labelColor: C.grey600 },
    { label: "TOTAL DEDUCTIONS", value: `(${money(payslip.total_deductions)})`, bg: C.grey100, textColor: C.red, labelColor: C.grey600 },
    { label: "NET PAY", value: money(payslip.net_pay), bg: C.navy, textColor: C.white, labelColor: C.skyMid }
  ];

  const blockH = 52;
  const boxW = CONTENT_W / boxes.length;

  boxes.forEach((box, index) => {
    const x = MARGIN + index * boxW;
    rect(doc, x, y, boxW, blockH, box.bg);
    if (index < boxes.length - 1) {
      vLine(doc, x + boxW, y + 4, blockH - 8, C.grey300, 0.7);
    }
    drawText(doc, box.label, x + 4, y + 10, {
      font: FONTS.bold, size: 7, color: box.labelColor,
      width: boxW - 8, align: "center", characterSpacing: 0.5
    });
    drawText(doc, box.value, x + 4, y + 26, {
      font: FONTS.bold, size: 13, color: box.textColor,
      width: boxW - 8, align: "center"
    });
  });

  hLine(doc, MARGIN, y + blockH, CONTENT_W, C.navy, 2);
  return y + blockH;
}

// ─── Signature Section ────────────────────────────────────────────────────────
function drawSignatureSection(doc, y) {
  y += 24;
  const colW = CONTENT_W / 2;

  const lines = [
    { label: "Prepared by", x: MARGIN + 8 },
    { label: "Received by", x: MARGIN + colW + 8 }
  ];

  for (const { label, x } of lines) {
    hLine(doc, x, y, colW - 24, C.grey600, 0.7);
    drawText(doc, label, x, y + 5, {
      font: FONTS.regular, size: 8, color: C.grey600, width: colW - 24, align: "center"
    });
  }

  return y + 24;
}

// ─── Notes ────────────────────────────────────────────────────────────────────
function drawNotes(doc, y, notes) {
  if (!notes) return y;
  y += 16;
  drawText(doc, "NOTES / REMARKS", MARGIN, y, {
    font: FONTS.bold, size: 7, color: C.navyMid, characterSpacing: 0.6
  });
  y += 12;
  drawText(doc, String(notes), MARGIN, y, {
    font: FONTS.regular, size: 8, color: C.grey700, width: CONTENT_W, lineBreak: true
  });
  return y + 16;
}

// ─── Main Render ──────────────────────────────────────────────────────────────
function renderPayslip(doc, payslip) {
  registerFonts(doc);
  const printedAt = formatDateTime(new Date());
  const meta = payslip?.metadata ?? {};

  drawPageHeader(doc, payslip, printedAt);

  let y = HEADER_H + TITLE_H + 12;
  y = drawEmployeeStrip(doc, y, payslip);
  y = drawBreakdownTable(doc, y, payslip);
  y = drawSummaryBoxes(doc, y, payslip);
  drawNotes(doc, y, payslip.notes);
  drawSignatureSection(doc, Math.min(y + (payslip.notes ? 60 : 16), PAGE_H - MARGIN - SYS_FTR_H - 50));
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function createPayslipPdf(payslip) {
  return new Promise((resolve, reject) => {
    logger.info({
      module: "payslips",
      payslipId: payslip?.id,
      renderer: "pdfkit"
    }, "Generating payslip PDF with PDFKit");

    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      info: {
        Title: `Payslip - ${payslip?.payslip_number ?? ""}`,
        Author: COMPANY.name,
        Subject: "Employee Payslip"
      }
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    renderPayslip(doc, payslip);
    doc.end();
  });
}

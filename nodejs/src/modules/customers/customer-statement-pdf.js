import PDFDocument from "pdfkit";
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

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 28;
const CONTENT_W = PAGE_W - (MARGIN * 2);
const HEADER_H = 64;
const TITLE_H = 40;
const SYS_FTR_H = 20;
const SECTION_GAP = 10;
const BODY_BOTTOM = PAGE_H - MARGIN - SYS_FTR_H - 8;
const CURRENCY_SYMBOL = "\u20b1";

const C = {
  navy: "#1a3557",
  navyMid: "#2c5f8a",
  navyLight: "#4a7fa8",
  skyLight: "#b3d4f0",
  skyMid: "#90caf9",
  blueBg: "#edf3f9",
  blueBorder: "#b0bec5",
  red: "#c62828",
  redDark: "#b71c1c",
  green: "#2e7d32",
  greenDark: "#1b5e20",
  greenBg: "#e8f5e9",
  brownWarm: "#6d4c41",
  yellowBg: "#fffde7",
  grey100: "#f4f7fb",
  grey200: "#eceff1",
  grey300: "#cfd8dc",
  grey600: "#607d8b",
  grey700: "#546e7a",
  grey800: "#37474f",
  black: "#212121",
  white: "#ffffff"
};

function resolveAssetPath(...segments) {
  const fromCwd = path.join(process.cwd(), ...segments);
  if (fs.existsSync(fromCwd)) return fromCwd;

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const nodeApiRoot = path.resolve(currentDir, "../../..");
  return path.join(nodeApiRoot, ...segments);
}

const REGULAR_FONT_PATH = resolveExistingAssetPath("assets", "fonts", "NotoSans-Regular.ttf");
const BOLD_FONT_PATH = resolveExistingAssetPath("assets", "fonts", "NotoSans-Bold.ttf");
const LOGO_PATH = resolveExistingAssetPath("assets", "systems", "logo.png");

const FONTS = {
  regular: REGULAR_FONT_PATH ? "NotoSans" : "Helvetica",
  bold: BOLD_FONT_PATH ? "NotoSans-Bold" : "Helvetica-Bold",
  mono: REGULAR_FONT_PATH ? "NotoSans" : "Courier",
  monoBold: BOLD_FONT_PATH ? "NotoSans-Bold" : "Courier-Bold"
};

function resolveExistingAssetPath(...segments) {
  const assetPath = resolveAssetPath(...segments);
  return fs.existsSync(assetPath) ? assetPath : null;
}

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

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date);
}

function getDateIdPart(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "00000000";
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function getDocumentNumber(customer, statement) {
  const id = customer.id ?? 0;
  return `C${id}_${getDateIdPart(statement.fromDate)}_${getDateIdPart(statement.toDate)}`;
}

function money(value) {
  return `${CURRENCY_SYMBOL} ${formatMoney(value)}`;
}

function rect(doc, x, y, w, h, fillColor, strokeColor = null, lineWidth = 0) {
  doc.save();
  if (strokeColor) {
    doc.lineWidth(lineWidth).strokeColor(strokeColor);
    if (fillColor) {
      doc.rect(x, y, w, h).fillAndStroke(fillColor, strokeColor);
    } else {
      doc.rect(x, y, w, h).stroke();
    }
  } else {
    doc.fillColor(fillColor).rect(x, y, w, h).fill();
  }
  doc.restore();
}

function hLine(doc, x, y, w, color = C.grey300, lineWidth = 0.5) {
  doc.save()
    .strokeColor(color)
    .lineWidth(lineWidth)
    .moveTo(x, y)
    .lineTo(x + w, y)
    .stroke()
    .restore();
}

function vLine(doc, x, y, h, color = C.grey300, lineWidth = 0.5) {
  doc.save()
    .strokeColor(color)
    .lineWidth(lineWidth)
    .moveTo(x, y)
    .lineTo(x, y + h)
    .stroke()
    .restore();
}

function drawText(doc, content, x, y, {
  font = FONTS.regular,
  size = 9,
  color = C.black,
  width,
  align = "left",
  lineBreak = false,
  ellipsis = true,
  characterSpacing = 0
} = {}) {
  doc.save()
    .font(font)
    .fontSize(size)
    .fillColor(color)
    .text(String(content ?? ""), x, y, {
      width,
      align,
      lineBreak,
      ellipsis,
      characterSpacing
    })
    .restore();
}

function drawPageHeader(doc, printedAt, docNumber) {
  rect(doc, 0, 0, PAGE_W, HEADER_H, C.white);

  const logoSize = 50;
  const gap = 10;

  const companyTextWidth = 360;
  const groupWidth = logoSize + gap + companyTextWidth;

  // Center the whole logo + text group
  const groupX = (PAGE_W - groupWidth) / 2 + 75;

  const logoX = groupX;
  const logoY = 10;

  const headingX = logoX + logoSize + gap;
  const headingW = companyTextWidth;

  if (LOGO_PATH) {
    doc.image(LOGO_PATH, logoX, logoY, {
      fit: [logoSize, logoSize]
    });
  }

  const baseY = 13;

  drawText(doc, COMPANY.name, headingX, baseY, {
    font: FONTS.bold,
    size: 15,
    color: C.navy,
    width: headingW,
    align: "left"
  });

  drawText(doc, COMPANY.address, headingX, baseY + 20, {
    font: FONTS.regular,
    size: 8,
    color: C.grey700,
    width: headingW,
    align: "left"
  });

  drawText(doc, `Tel: ${COMPANY.phone} • Email: ${COMPANY.email}`, headingX, baseY + 30, {
    font: FONTS.regular,
    size: 8,
    color: C.grey700,
    width: headingW,
    align: "left"
  });

  rect(doc, MARGIN, HEADER_H, CONTENT_W, TITLE_H, C.navy);

  drawText(doc, "STATEMENT OF ACCOUNT", MARGIN, HEADER_H + 8, {
    font: FONTS.bold,
    size: 13,
    color: C.white,
    width: CONTENT_W,
    align: "center",
    characterSpacing: 2
  });

  drawText(doc, "Accounts Receivable - Official Financial Statement", MARGIN, HEADER_H + 27, {
    font: FONTS.regular,
    size: 8,
    color: C.skyMid,
    width: CONTENT_W,
    align: "center"
  });

  const footerY = PAGE_H - MARGIN - SYS_FTR_H;

  rect(doc, MARGIN, footerY, CONTENT_W, SYS_FTR_H, C.navy);

  drawText(
    doc,
    `System-generated statement | ${COMPANY.name} - Accounts Receivable | Valid without wet signature.`,
    MARGIN + 8,
    footerY + 6,
    {
      font: FONTS.regular,
      size: 7,
      color: C.skyMid,
      width: CONTENT_W * 0.6
    }
  );

  drawText(doc, `Ref: ${docNumber} | Printed: ${printedAt}`, MARGIN + 8, footerY + 6, {
    font: FONTS.regular,
    size: 7,
    color: C.skyMid,
    width: CONTENT_W - 16,
    align: "right"
  });
}

function addPage(doc, state) {
  if (state.pageNumber > 0) {
    doc.addPage({ size: "A4", margin: 0 });
  }

  state.pageNumber += 1;
  drawPageHeader(doc, state.printedAt, state.docNumber);
  state.y = HEADER_H + TITLE_H;
}

function ensureSpace(doc, state, requiredHeight) {
  if (state.y + requiredHeight <= BODY_BOTTOM) return;
  addPage(doc, state);
}

function drawCustomerStrip(doc, state, customer, details) {
  const blockHeight = 72;
  rect(doc, MARGIN, state.y, PAGE_W - (MARGIN * 2), blockHeight, C.grey100);
  hLine(doc, MARGIN, state.y + blockHeight, CONTENT_W, C.grey300, 0.7);

  const col1W = CONTENT_W * 0.6;
  const col2X = MARGIN + col1W;

  drawText(doc, "ACCOUNT HOLDER", MARGIN + 8, state.y + 9, {
    font: FONTS.bold,
    size: 7,
    color: C.navyMid,
    characterSpacing: 0.7
  });
  drawText(doc, details.custName, MARGIN + 8, state.y + 20, {
    font: FONTS.bold,
    size: 10,
    color: C.navy,
    width: col1W - 14
  });
  drawText(doc, details.custAddr, MARGIN + 8, state.y + 38, {
    font: FONTS.regular,
    size: 8,
    color: C.grey700,
    width: col1W - 14
  });
  drawText(doc, `Tel: ${details.custPhone}   Email: ${details.custEmail}`, MARGIN + 8, state.y + 49, {
    font: FONTS.regular,
    size: 8,
    color: C.grey700,
    width: col1W - 14
  });

  vLine(doc, col2X, state.y + 6, blockHeight - 12, C.grey300, 0.7);

  drawText(doc, "ACCOUNT DETAILS", col2X + 10, state.y + 9, {
    font: FONTS.bold,
    size: 7,
    color: C.navyMid,
    characterSpacing: 0.7
  });

  const detailLines = [
    ["Contact Person:", details.custContact],
    ["Statement Period:", `${details.fromDate} - ${details.toDate}`],
    ["Transactions:", `${details.txCount} record(s)`],
    ["Document No.:", state.docNumber]
  ];

  let detailY = state.y + 21;
  for (const [label, value] of detailLines) {
    drawText(doc, label, col2X + 10, detailY, {
      font: FONTS.bold,
      size: 8,
      color: C.grey800
    });
    drawText(doc, value, col2X + 95, detailY, {
      font: FONTS.regular,
      size: 8,
      color: C.grey700,
      width: CONTENT_W - col1W - 113
    });
    detailY += 11;
  }

  state.y += blockHeight;
}

function drawSummaryBoxes(doc, state, metrics) {
  const blockHeight = 48;
  const boxes = [
    { label: "Opening Balance", value: money(metrics.openingBal), bg: C.white, textColor: C.navy, labelColor: C.grey600 },
    { label: "Total Charges", value: `+ ${money(metrics.totalDebit)}`, bg: C.white, textColor: C.red, labelColor: C.grey600 },
    { label: "Total Payments", value: `- ${money(metrics.totalCredit)}`, bg: C.white, textColor: C.green, labelColor: C.grey600 },
    { label: "Total Overdue", value: money(metrics.totalOverdue), bg: C.navy, textColor: C.white, labelColor: C.skyMid }
  ];

  const boxWidth = CONTENT_W / boxes.length;
  boxes.forEach((box, index) => {
    const x = MARGIN + (index * boxWidth);
    rect(doc, x, state.y, boxWidth, blockHeight, box.bg);
    if (index < boxes.length - 1) {
      vLine(doc, x + boxWidth, state.y + 4, blockHeight - 8, C.grey300, 0.7);
    }

    drawText(doc, box.label.toUpperCase(), x + 4, state.y + 10, {
      font: FONTS.bold,
      size: 7,
      color: box.labelColor,
      width: boxWidth - 8,
      align: "center",
      characterSpacing: 0.5
    });
    drawText(doc, box.value, x + 4, state.y + 24, {
      font: FONTS.bold,
      size: 13,
      color: box.textColor,
      width: boxWidth - 8,
      align: "center"
    });
  });

  hLine(doc, MARGIN, state.y + blockHeight, CONTENT_W, C.navy, 2);
  state.y += blockHeight;
}

function drawSectionBar(doc, y, leftLabel, rightLabel) {
  const height = 20;
  rect(doc, MARGIN, y, CONTENT_W, height, C.navyMid);
  drawText(doc, leftLabel, MARGIN + 8, y + 6, {
    font: FONTS.bold,
    size: 8,
    color: C.skyLight,
    characterSpacing: 0.7
  });
  drawText(doc, rightLabel, MARGIN + 8, y + 6, {
    font: FONTS.regular,
    size: 8,
    color: C.skyMid,
    width: CONTENT_W - 16,
    align: "right"
  });
  return y + height;
}

function getTransactionColumns() {
  const cols = [
    { label: "Date", key: "date", widthRatio: 0.10, align: "left", font: FONTS.mono },
    { label: "Due Date", key: "dueDate", widthRatio: 0.10, align: "left", font: FONTS.mono },
    { label: "Description", key: "description", widthRatio: 0.26, align: "left", font: FONTS.bold },
    { label: "Ref No.", key: "reference", widthRatio: 0.18, align: "left", font: FONTS.mono },
    { label: "Debit", key: "debit", widthRatio: 0.12, align: "right", font: FONTS.regular },
    { label: "Credit", key: "credit", widthRatio: 0.12, align: "right", font: FONTS.regular },
    { label: "Balance", key: "balance", widthRatio: 0.12, align: "right", font: FONTS.bold }
  ];

  return cols.map((col) => ({
    ...col,
    width: col.widthRatio * CONTENT_W
  }));
}

function drawTransactionTableHeader(doc, y, columns) {
  const height = 18;
  rect(doc, MARGIN, y, CONTENT_W, height, C.navy);

  let x = MARGIN;
  columns.forEach((column) => {
    drawText(doc, column.label.toUpperCase(), x + 5, y + 5, {
      font: FONTS.bold,
      size: 7.5,
      color: C.white,
      width: column.width - 8,
      align: column.align
    });
    x += column.width;
  });

  return y + height;
}

function drawOpeningBalanceRow(doc, y, fromDate, openingBal) {
  const height = 16;
  rect(doc, MARGIN, y, CONTENT_W, height, C.yellowBg);
  drawText(doc, `Opening Balance - ${fromDate}`, MARGIN + 5, y + 4, {
    font: FONTS.bold,
    size: 8.5,
    color: C.brownWarm,
    width: CONTENT_W * 0.76
  });
  drawText(doc, money(openingBal), MARGIN + 5, y + 4, {
    font: FONTS.bold,
    size: 8.5,
    color: C.brownWarm,
    width: CONTENT_W - 10,
    align: "right"
  });
  return y + height;
}

function drawTransactionRow(doc, y, columns, transaction, rowIndex) {
  const height = 18;
  const background = rowIndex % 2 === 0 ? C.white : C.grey100;
  rect(doc, MARGIN, y, CONTENT_W, height, background);

  const now = new Date();
  const debitVal = Number(transaction.debit ?? 0);
  const creditVal = Number(transaction.credit ?? 0);
  const dueDate = transaction.dueDate ? new Date(transaction.dueDate) : null;
  const isOverdue = dueDate && !Number.isNaN(dueDate.getTime()) && dueDate < now && debitVal > 0;

  let x = MARGIN;
  columns.forEach((column) => {
    if (column.key === "balance") {
      rect(doc, x, y, column.width, height, C.blueBg);
      vLine(doc, x, y, height, C.blueBorder, 1.5);
    }

    let value = "";
    let color = C.black;

    if (column.key === "date") {
      value = formatDate(transaction.date);
      color = C.grey700;
    } else if (column.key === "dueDate") {
      value = transaction.dueDate ? formatDate(transaction.dueDate) : "-";
      color = isOverdue ? C.redDark : C.grey700;
    } else if (column.key === "description") {
      value = transaction.description || "";
    } else if (column.key === "reference") {
      value = transaction.reference || "";
      color = C.grey700;
    } else if (column.key === "debit") {
      value = debitVal > 0 ? money(debitVal) : "-";
    } else if (column.key === "credit") {
      value = creditVal > 0 ? money(creditVal) : "-";
      color = creditVal > 0 ? C.greenDark : C.black;
    } else if (column.key === "balance") {
      value = money(transaction.balance);
      color = C.navy;
    }

    drawText(doc, value, x + 5, y + 5, {
      font: column.font,
      size: 6.5,
      color,
      width: column.width - 10,
      align: column.align
    });

    x += column.width;
  });

  hLine(doc, MARGIN, y + height, CONTENT_W, C.grey200, 0.5);
  return y + height;
}

function drawClosingBalanceRow(doc, y, toDate, closingBal) {
  const height = 18;
  rect(doc, MARGIN, y, CONTENT_W, height, C.greenBg);
  drawText(doc, `Closing Balance - ${toDate}`, MARGIN + 5, y + 4, {
    font: FONTS.bold,
    size: 8.5,
    color: C.greenDark,
    width: CONTENT_W * 0.76
  });
  drawText(doc, money(closingBal), MARGIN + 5, y + 4, {
    font: FONTS.bold,
    size: 9,
    color: closingBal > 0 ? C.redDark : C.greenDark,
    width: CONTENT_W - 10,
    align: "right"
  });
  return y + height;
}

function drawAgingSection(doc, state, statement, toDate) {
  state.y += SECTION_GAP;
  state.y = drawSectionBar(doc, state.y, "AGING OF ACCOUNTS RECEIVABLE", `As of ${toDate}`);

  const items = [
    { label: "Current", value: statement.aging?.current ?? 0, overdue: false },
    { label: "1-30 Days", value: statement.aging?.days_1_30 ?? 0, overdue: true },
    { label: "31-60 Days", value: statement.aging?.days_31_60 ?? 0, overdue: true },
    { label: "61-90 Days", value: statement.aging?.days_61_90 ?? 0, overdue: true },
    { label: "Over 90 Days", value: statement.aging?.over_90 ?? 0, overdue: true }
  ];

  const blockHeight = 44;
  const cellWidth = CONTENT_W / items.length;
  rect(doc, MARGIN, state.y, CONTENT_W, blockHeight, C.grey100);
  hLine(doc, MARGIN, state.y + blockHeight, CONTENT_W, C.grey300, 0.7);

  items.forEach((item, index) => {
    const x = MARGIN + (index * cellWidth);
    if (index < items.length - 1) {
      vLine(doc, x + cellWidth, state.y + 4, blockHeight - 8, C.grey300, 0.7);
    }

    drawText(doc, item.label.toUpperCase(), x + 4, state.y + 8, {
      font: FONTS.bold,
      size: 7,
      color: C.grey600,
      width: cellWidth - 8,
      align: "center",
      characterSpacing: 0.4
    });
    drawText(doc, money(item.value), x + 4, state.y + 22, {
      font: FONTS.bold,
      size: 11,
      color: item.overdue && Number(item.value) > 0 ? C.redDark : C.navy,
      width: cellWidth - 8,
      align: "center"
    });
  });

  state.y += blockHeight;
}

function drawFooterSummary(doc, state, metrics) {
  state.y += SECTION_GAP;
  hLine(doc, MARGIN, state.y, CONTENT_W, C.navy, 2);
  state.y += 6;

  const notesWidth = CONTENT_W * 0.56;
  const totalsX = MARGIN + notesWidth + 8;
  const totalsWidth = CONTENT_W * 0.44 - 8;

  const notesTop = state.y;
  drawText(doc, "IMPORTANT REMINDERS", MARGIN, notesTop, {
    font: FONTS.bold,
    size: 7,
    color: C.navyMid,
    characterSpacing: 0.7
  });

  const notes = [
    "1. Please review and report any discrepancies within 15 days.",
    "2. Payments received after the statement date are not reflected.",
    `3. Make checks payable to ${COMPANY.name}.`,
    `4. For inquiries: ${COMPANY.email} | ${COMPANY.phone}`,
    "5. CONFIDENTIAL - For addressee use only."
  ];

  let noteY = notesTop + 12;
  notes.forEach((line, index) => {
    drawText(doc, line, MARGIN, noteY, {
      font: index === 4 ? FONTS.bold : FONTS.regular,
      size: 6.5,
      color: C.grey700,
      width: notesWidth
    });
    noteY += 13;
  });

  const rows = [
    { label: "Opening Balance", value: formatMoney(metrics.openingBal), color: C.black },
    { label: "+ New Charges (Period)", value: formatMoney(metrics.totalDebit), color: C.red },
    { label: "- Payments (Period)", value: formatMoney(metrics.totalCredit), color: C.green },
    { label: "Total Account Balance", value: formatMoney(metrics.closingBal), color: C.black, divider: true },
    { label: "- Not Yet Due", value: formatMoney(metrics.notYetDue), color: C.grey600 }
  ];

  let rowY = notesTop;
  rows.forEach((row) => {
    if (row.divider) hLine(doc, totalsX, rowY - 1, totalsWidth, C.grey300, 1);

    drawText(doc, row.label, totalsX, rowY + 4, {
      font: FONTS.regular,
      size: 8,
      color: C.grey600,
      width: totalsWidth * 0.58
    });
    drawText(doc, `${CURRENCY_SYMBOL} ${row.value}`, totalsX, rowY + 4, {
      font: FONTS.bold,
      size: 8,
      color: row.color,
      width: totalsWidth - 4,
      align: "right"
    });
    rowY += 16;
  });

  rect(doc, totalsX, rowY, totalsWidth, 26, C.navy);
  drawText(doc, "AMOUNT DUE NOW", totalsX + 8, rowY + 8, {
    font: FONTS.bold,
    size: 8,
    color: C.skyLight
  });
  drawText(doc, money(metrics.amountDue), totalsX + 8, rowY + 7, {
    font: FONTS.bold,
    size: 13,
    color: C.white,
    width: totalsWidth - 12,
    align: "right"
  });

  state.y = Math.max(noteY, rowY + 26);
}

function renderStatement(doc, customer, statement) {
  registerFonts(doc);

  const fromDate = formatDate(statement.fromDate);
  const toDate = formatDate(statement.toDate);
  const printedAt = formatDateTime(new Date());
  const docNumber = getDocumentNumber(customer, statement);

  const transactions = statement.transactions ?? [];
  const openingBal = Number(statement.openingBalance ?? 0);
  const closingBal = Number(statement.closingBalance ?? 0);
  const totalDebit = transactions.reduce((sum, item) => sum + Number(item.debit ?? 0), 0);
  const totalCredit = transactions.reduce((sum, item) => sum + Number(item.credit ?? 0), 0);
  const notYetDue = Number(statement.aging?.current ?? 0);
  const totalOverdue = Number(statement.aging?.days_1_30 ?? 0)
    + Number(statement.aging?.days_31_60 ?? 0)
    + Number(statement.aging?.days_61_90 ?? 0)
    + Number(statement.aging?.over_90 ?? 0);

  const details = {
    fromDate,
    toDate,
    txCount: transactions.length,
    custName: customer.company || customer.name || "Customer",
    custContact: customer.name || "N/A",
    custAddr: customer.address || "N/A",
    custPhone: customer.phone || "N/A",
    custEmail: customer.email || "N/A"
  };

  const metrics = {
    openingBal,
    closingBal,
    totalDebit,
    totalCredit,
    notYetDue,
    totalOverdue,
    amountDue: closingBal - notYetDue
  };

  const state = {
    pageNumber: 0,
    y: 0,
    printedAt,
    docNumber
  };

  addPage(doc, state);
  drawCustomerStrip(doc, state, customer, details);
  drawSummaryBoxes(doc, state, metrics);

  state.y += SECTION_GAP;
  state.y = drawSectionBar(
    doc,
    state.y,
    "TRANSACTION HISTORY",
    `${fromDate} - ${toDate} | ${transactions.length} record(s)`
  );

  const columns = getTransactionColumns();
  state.y = drawTransactionTableHeader(doc, state.y, columns);
  state.y = drawOpeningBalanceRow(doc, state.y, fromDate, openingBal);

  transactions.forEach((transaction, index) => {
    if (state.y + 18 > BODY_BOTTOM) {
      addPage(doc, state);
      state.y = drawSectionBar(
        doc,
        state.y,
        "TRANSACTION HISTORY (CONTINUED)",
        `${fromDate} - ${toDate} | ${transactions.length} record(s)`
      );
      state.y = drawTransactionTableHeader(doc, state.y, columns);
    }

    state.y = drawTransactionRow(doc, state.y, columns, transaction, index);
  });

  if (state.y + 18 > BODY_BOTTOM) {
    addPage(doc, state);
    state.y = drawSectionBar(
      doc,
      state.y,
      "TRANSACTION HISTORY (CONTINUED)",
      `${fromDate} - ${toDate} | ${transactions.length} record(s)`
    );
    state.y = drawTransactionTableHeader(doc, state.y, columns);
  }
  state.y = drawClosingBalanceRow(doc, state.y, toDate, closingBal);

  const tailHeight = 20 + 44 + 10 + 6 + 100 + 26;
  ensureSpace(doc, state, tailHeight);
  drawAgingSection(doc, state, statement, toDate);
  drawFooterSummary(doc, state, metrics);
}

export async function createCustomerStatementPdf(customer, statement) {
  const customerId = customer?.id ?? null;

  return new Promise((resolve, reject) => {
    logger.info({
      module: "customers",
      document: "customer-statement",
      customerId,
      fromDate: statement?.fromDate ?? null,
      toDate: statement?.toDate ?? null,
      renderer: "pdfkit",
      logoPath: LOGO_PATH
    }, "Generating customer statement PDF with PDFKit");

    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      info: {
        Title: `Statement of Account - ${customer?.company || customer?.name || "Customer"}`,
        Author: COMPANY.name,
        Subject: "Accounts Receivable Statement"
      }
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", (error) => {
      logger.error({
        err: error,
        module: "customers",
        document: "customer-statement",
        customerId,
        fromDate: statement?.fromDate ?? null,
        toDate: statement?.toDate ?? null,
        renderer: "pdfkit"
      }, "Customer statement PDF generation failed");
      reject(error);
    });
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      logger.info({
        module: "customers",
        document: "customer-statement",
        customerId,
        bytes: pdfBuffer.length,
        renderer: "pdfkit"
      }, "Customer statement PDF generated successfully");
      resolve(pdfBuffer);
    });

    try {
      renderStatement(doc, customer, statement);
      doc.end();
    } catch (error) {
      logger.error({
        err: error,
        module: "customers",
        document: "customer-statement",
        customerId,
        fromDate: statement?.fromDate ?? null,
        toDate: statement?.toDate ?? null,
        renderer: "pdfkit"
      }, "Customer statement PDF generation failed during render");
      reject(error);
    }
  });
}

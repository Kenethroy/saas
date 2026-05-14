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

function resolveProductImageAsBase64(fileUrl) {
  if (!fileUrl) return null;
  
  let relativePath = "";
  try {
    const url = new URL(fileUrl);
    relativePath = url.pathname.replace(/^\//, "");
  } catch {
    relativePath = String(fileUrl).replace(/^\//, "");
  }

  // Define potential root directories for uploads
  const workspaceRoot = path.resolve(process.cwd(), "..");
  
  // Extract just the filename in case relativePath is just the name
  const fileName = path.basename(relativePath);

  const candidates = [
    path.join(process.cwd(), relativePath), 
    path.join(workspaceRoot, relativePath),
    path.join(workspaceRoot, "uploads", "products", fileName),
    path.join(process.cwd(), "uploads", "products", fileName)
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.lstatSync(candidate).isFile()) {
      const bitmap = fs.readFileSync(candidate);
      const ext = path.extname(candidate).toLowerCase().replace(".", "");
      return `data:image/${ext || "png"};base64,${bitmap.toString("base64")}`;
    }
  }

  // Last resort: check if the fileUrl is just a filename
  const absoluteUploadsPath = "/Users/fdc-kennethroy-nc-web/jrspc-system/uploads/products";
  const fallbackPath = path.join(absoluteUploadsPath, fileName);
  if (fs.existsSync(fallbackPath) && fs.lstatSync(fallbackPath).isFile()) {
    const bitmap = fs.readFileSync(fallbackPath);
    const ext = path.extname(fallbackPath).toLowerCase().replace(".", "");
    return `data:image/${ext || "png"};base64,${bitmap.toString("base64")}`;
  }

  return null;
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

function generateBrochureHtml(categories) {
  const logoBase64 = resolveSystemLogoAsBase64();
  const logoImg = logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="height:48px; display:block;">` : "";
  const printedAt = formatDate(new Date());

  let contentHtml = "";

  categories.forEach(category => {
    if (!category.products || category.products.length === 0) return;

    contentHtml += `
      <div class="category-section">
        <div class="category-header">
          <span class="category-dot">•</span>
          ${category.name}
        </div>
        <div class="product-grid">
    `;

    category.products.forEach(product => {
      const imgBase64 = resolveProductImageAsBase64(product.fileUrl);
      const imgHtml = imgBase64 
        ? `<div class="product-img-container"><img src="${imgBase64}" class="product-img"></div>`
        : `<div class="product-img-placeholder">${(product.name || "P")[0].toUpperCase()}</div>`;

      let variantsHtml = "";
      const variants = product.variants || [];
      if (variants.length === 0) {
        variantsHtml = `<div class="variant-row no-variant">No active variants</div>`;
      } else {
        variants.forEach(v => {
          variantsHtml += `
            <div class="variant-row">
              <span class="variant-name">${v.name || "Standard"}</span>
              <span class="variant-price">&#8369;&nbsp;${formatMoney(v.unitPrice)}</span>
            </div>
          `;
        });
      }

      contentHtml += `
        <div class="product-card">
          <div class="product-card-inner">
            <div class="product-left">
              ${imgHtml}
              <div class="product-name">${product.name}</div>
            </div>
            <div class="product-right">
              ${variantsHtml}
            </div>
          </div>
        </div>
      `;
    });

    contentHtml += `
        </div>
      </div>
    `;
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #333; background: #fff; line-height: 1.4; }

/* REPEATING HEADER TRICK */
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
tfoot { display: table-footer-group; }

.page-content { padding: 0 20px 20px 20px; }

/* HEADER */
.header-container { padding: 20px 20px 10px 20px; background: #fff; }
.header { display: flex; align-items: center; justify-content: center; padding-bottom: 10px; border-bottom: 2px solid #1a3557; }
.header-logo { margin-right: 20px; }
.header-info { text-align: center; }
.header-name { font-size: 20px; font-weight: bold; color: #1a3557; margin-bottom: 4px; }
.header-sub { font-size: 10px; color: #666; }

/* TITLE - PLAIN STYLE */
.title-bar { background: transparent; color: #1a3557; text-align: center; padding: 10px; margin-top: 10px; margin-bottom: 20px; border-bottom: 2px solid #f0f4f8; }
.title-text { font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; }
.title-date { font-size: 9px; color: #666; margin-top: 4px; font-weight: normal; }

/* CATEGORY */
.category-section { margin-bottom: 25px; page-break-inside: avoid; }
.category-header { 
  background: transparent; 
  color: #1a3557; 
  font-size: 14px; 
  font-weight: bold; 
  padding: 10px 0; 
  margin-bottom: 15px; 
  text-transform: uppercase; 
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
}
.category-dot { color: #1a3557; font-size: 24px; margin-right: 10px; line-height: 0; }

/* PRODUCT GRID */
.product-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }

/* PRODUCT CARD */
.product-card { border: 1px solid #e1e8ed; border-radius: 6px; overflow: hidden; background: #fff; page-break-inside: avoid; }
.product-card-inner { display: flex; padding: 10px; min-height: 110px; }

.product-left { width: 40%; display: flex; flex-direction: column; align-items: center; border-right: 1px solid #f0f4f8; padding-right: 10px; }
.product-img-container { width: 100%; height: 75px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; }
.product-img { max-width: 100%; max-height: 100%; object-fit: contain; }
.product-img-placeholder { width: 100%; height: 75px; background: #f8fbff; color: #cbd5e0; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: bold; margin-bottom: 6px; border-radius: 4px; }
.product-name { font-weight: bold; color: #1a3557; text-align: center; font-size: 10px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.product-right { width: 60%; padding-left: 10px; display: flex; flex-direction: column; justify-content: center; }
.variant-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #edf2f7; font-size: 9px; }
.variant-row:last-child { border-bottom: none; }
.variant-name { color: #4a5568; font-weight: 500; }
.variant-price { font-weight: bold; color: #2d3748; font-family: 'Courier New', Courier, monospace; }
.no-variant { color: #a0aec0; font-style: italic; justify-content: center; }

/* FOOTER */
.footer-container { padding: 10px 20px; border-top: 1px solid #eee; text-align: center; font-size: 9px; color: #999; }
</style>
</head>
<body>
  <table>
    <thead>
      <tr>
        <td>
          <div class="header-container">
            <div class="header">
              <div class="header-logo">${logoImg}</div>
              <div class="header-info">
                <div class="header-name">${COMPANY.name}</div>
                <div class="header-sub">${COMPANY.address} | Tel: ${COMPANY.phone} | Email: ${COMPANY.email}</div>
              </div>
            </div>
          </div>
        </td>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <div class="page-content">
            <div class="title-bar">
              <div class="title-text">Product Price List</div>
              <div class="title-date">Generated on ${printedAt}</div>
            </div>
            ${contentHtml}
          </div>
        </td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td>
          <div class="footer-container">
            &copy; ${new Date().getFullYear()} ${COMPANY.name}. System-generated product brochure. Prices subject to change.
          </div>
        </td>
      </tr>
    </tfoot>
  </table>
</body>
</html>
  `;
}

export async function createProductBrochurePdf(categories = []) {
  let browser;
  try {
    logger.info({
      module: "products",
      document: "product-brochure",
      categoryCount: Array.isArray(categories) ? categories.length : 0,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? null
    }, "Launching Puppeteer browser for product brochure PDF generation");

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    logger.info({
      module: "products",
      document: "product-brochure",
      categoryCount: Array.isArray(categories) ? categories.length : 0
    }, "Starting product brochure PDF generation");

    const page = await browser.newPage();
    const html = generateBrochureHtml(categories);
    try {
      await page.setContent(html, { waitUntil: "load" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "0mm",
          bottom: "0mm",
          left: "0mm",
          right: "0mm"
        }
      });

      logger.info({
        module: "products",
        document: "product-brochure",
        categoryCount: Array.isArray(categories) ? categories.length : 0,
        bytes: pdfBuffer.length
      }, "Product brochure PDF generated successfully");

      return pdfBuffer;
    } finally {
      await page.close();
    }
  } catch (error) {
    logger.error({
      err: error,
      module: "products",
      document: "product-brochure",
      categoryCount: Array.isArray(categories) ? categories.length : 0
    }, "Product brochure PDF generation failed");
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

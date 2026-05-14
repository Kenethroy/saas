import xlsx from 'xlsx';

const workbook = xlsx.readFile('/Users/fdc-kennethroy-nc-web/jrspc-system/products_20260507140809.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// The headers are at row 4 (0-indexed). So we set range to 4
const data = xlsx.utils.sheet_to_json(sheet, { range: 4, header: [
  'id', 'name', 'sku', 'description', 'category', 'unitCost', 'unitPrice', 'stockQuantity', 'status', 'fileUrl'
] });

console.log(JSON.stringify(data.slice(0, 10), null, 2));

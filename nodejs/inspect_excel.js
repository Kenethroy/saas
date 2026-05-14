import xlsx from 'xlsx';

const workbook = xlsx.readFile('/Users/fdc-kennethroy-nc-web/jrspc-system/products_20260507132935.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Skip first 3 rows (title, date, headers) and map headers
const data = xlsx.utils.sheet_to_json(sheet, { range: 3, header: [
  'id', 'name', 'sku', 'description', 'category', 'unitCost', 'unitPrice', 'stockQuantity', 'status'
] });

console.log(JSON.stringify(data.slice(0, 30), null, 2));

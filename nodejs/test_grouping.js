import xlsx from 'xlsx';

const workbook = xlsx.readFile('/Users/fdc-kennethroy-nc-web/jrspc-system/products_20260507132935.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const data = xlsx.utils.sheet_to_json(sheet, { range: 3, header: [
  'id', 'name', 'sku', 'description', 'category', 'unitCost', 'unitPrice', 'stockQuantity', 'status'
] });

function getCommonPrefix(a, b) {
  let i = 0;
  while(i < a.length && i < b.length && a[i] === b[i]) {
    i++;
  }
  return a.substring(0, i);
}

function getCommonPrefixOfArray(arr) {
  if (!arr.length) return "";
  let prefix = arr[0];
  for (let i = 1; i < arr.length; i++) {
    prefix = getCommonPrefix(prefix, arr[i]);
  }
  return prefix;
}

let sortedProducts = [...data].filter(p => p.name).sort((a,b) => a.name.localeCompare(b.name));
let grouped = [];
let i = 0;

while (i < sortedProducts.length) {
  let current = sortedProducts[i];
  let j = i + 1;
  let bestPrefix = current.name;
  
  // Find extent of matching prefix ending at a space
  while (j < sortedProducts.length) {
    let prefix = getCommonPrefix(current.name, sortedProducts[j].name);
    let lastSpace = prefix.lastIndexOf(' ');
    if (lastSpace > 0) {
      let validPrefix = prefix.substring(0, lastSpace);
      // We need to ensure that the prefix is substantial enough and doesn't just match "A"
      if (validPrefix.length > 3) {
        j++;
        continue;
      }
    }
    break;
  }
  
  if (j > i + 1) {
    let groupPrefix = getCommonPrefixOfArray(sortedProducts.slice(i, j).map(p => p.name));
    let lastSpace = groupPrefix.lastIndexOf(' ');
    if (lastSpace > 0) {
      groupPrefix = groupPrefix.substring(0, lastSpace);
    }
    grouped.push({
      parentName: groupPrefix.trim(),
      items: sortedProducts.slice(i, j)
    });
    i = j;
  } else {
    grouped.push({
      parentName: current.name,
      items: [current]
    });
    i++;
  }
}

// Print some groups
console.log(`Total products: ${data.length}`);
console.log(`Total groups: ${grouped.length}`);
for (let g of grouped.slice(0, 20)) {
  console.log(`Parent: ${g.parentName} (${g.items.length} variants)`);
  for (let item of g.items.slice(0, 3)) {
    let variantName = item.name.substring(g.parentName.length).trim();
    if (!variantName) variantName = 'Default';
    console.log(`  - Variant: ${variantName} | Name: ${item.name}`);
  }
  if (g.items.length > 3) console.log(`  ... and ${g.items.length - 3} more`);
}

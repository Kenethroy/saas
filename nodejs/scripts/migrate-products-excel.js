import xlsx from 'xlsx';
import pool from '#shared/database/mysql';

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

async function run() {
  console.log('Reading Excel file...');
  // Updated to new file
  const workbook = xlsx.readFile('/Users/fdc-kennethroy-nc-web/jrspc-system/products_20260507140809.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Updated range to 4 to skip the first 4 rows
  const data = xlsx.utils.sheet_to_json(sheet, { range: 4, header: [
    'id', 'name', 'sku', 'description', 'category', 'unitCost', 'unitPrice', 'stockQuantity', 'status', 'fileUrl'
  ] });

  let sortedProducts = [...data].filter(p => p.name).sort((a,b) => a.name.localeCompare(b.name));
  let grouped = [];
  let i = 0;

  while (i < sortedProducts.length) {
    let current = sortedProducts[i];
    let j = i + 1;
    
    // Find extent of matching prefix ending at a space
    while (j < sortedProducts.length) {
      let prefix = getCommonPrefix(current.name, sortedProducts[j].name);
      let lastSpace = prefix.lastIndexOf(' ');
      if (lastSpace > 0) {
        let validPrefix = prefix.substring(0, lastSpace);
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

  console.log(`Found ${grouped.length} unique products with variants.`);

  console.log('Truncating tables...');
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query('TRUNCATE TABLE product_variants');
  await pool.query('TRUNCATE TABLE products');
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('Processing Categories...');
  const categoryNames = [...new Set(data.filter(d => d.category).map(d => d.category))];
  const categoryMap = new Map();

  for (const catName of categoryNames) {
    const [rows] = await pool.query('SELECT id FROM categories WHERE name = ?', [catName]);
    if (rows.length > 0) {
      categoryMap.set(catName, rows[0].id);
    } else {
      const [res] = await pool.query('INSERT INTO categories (name, status) VALUES (?, 1)', [catName]);
      categoryMap.set(catName, res.insertId);
    }
  }

  console.log('Inserting Products and Variants...');
  for (const group of grouped) {
    const catName = group.items[0].category;
    const catId = categoryMap.get(catName) || null;
    const fileUrl = group.items[0].fileUrl || null;

    const [pRes] = await pool.query(
      'INSERT INTO products (name, description, category_id, file_url, status) VALUES (?, ?, ?, ?, 1)',
      [group.parentName, group.items[0].description || null, catId, fileUrl]
    );
    const productId = pRes.insertId;

    for (const item of group.items) {
      let variantName = item.name.substring(group.parentName.length).trim();
      if (!variantName) {
        variantName = 'Default';
      }
      
      await pool.query(
        'INSERT INTO product_variants (product_id, name, unit_cost, unit_price, stock_quantity, reorder_level, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          productId,
          variantName,
          Number(item.unitCost) || 0,
          Number(item.unitPrice) || 0,
          Number(item.stockQuantity) || 0,
          0,
          item.status === 'Active' ? 1 : 0
        ]
      );
    }
  }

  console.log('Migration completed successfully.');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

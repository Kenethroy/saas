USE `jrspc_node`;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  po_number VARCHAR(50) NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  order_date DATE NOT NULL,
  expected_date DATE DEFAULT NULL,
  payment_term_id INT DEFAULT NULL,
  status ENUM('pending','approved','processing','completed','cancelled') NOT NULL DEFAULT 'pending',
  items_subtotal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  discount_type ENUM('none','percentage','fixed') NOT NULL DEFAULT 'none',
  discount_value DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  notes TEXT DEFAULT NULL,
  delete_flg TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_ip VARCHAR(45) DEFAULT NULL,
  updated_ip VARCHAR(45) DEFAULT NULL,
  CONSTRAINT uq_purchase_orders_number UNIQUE (po_number),
  INDEX idx_purchase_orders_supplier_id (supplier_id),
  INDEX idx_purchase_orders_payment_term_id (payment_term_id),
  INDEX idx_purchase_orders_status (status),
  INDEX idx_purchase_orders_delete_flg (delete_flg),
  CONSTRAINT fk_purchase_orders_supplier_id FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_purchase_orders_payment_term_id FOREIGN KEY (payment_term_id) REFERENCES payment_terms(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  product_variant_id BIGINT UNSIGNED NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  variant_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(15,2) NOT NULL,
  line_discount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  line_total DECIMAL(15,2) NOT NULL,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_purchase_order_items_po_id (purchase_order_id),
  INDEX idx_purchase_order_items_product_id (product_id),
  INDEX idx_purchase_order_items_product_variant_id (product_variant_id),
  CONSTRAINT fk_purchase_order_items_po_id FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_order_items_product_id FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_purchase_order_items_product_variant_id FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
);

INSERT INTO permissions (slug, name, description, status, delete_flg, created_at, updated_at)
VALUES
  ('purchaseOrders.view', 'View Purchase Orders', 'Access purchase order records and summaries', 1, 0, NOW(), NOW()),
  ('purchaseOrders.create', 'Create Purchase Orders', 'Create new purchase orders', 1, 0, NOW(), NOW()),
  ('purchaseOrders.update', 'Update Purchase Orders', 'Edit existing purchase orders', 1, 0, NOW(), NOW()),
  ('purchaseOrders.delete', 'Delete Purchase Orders', 'Remove or cancel purchase orders', 1, 0, NOW(), NOW()),
  ('purchaseOrders.approve', 'Approve Purchase Orders', 'Approve purchase orders for processing', 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  status = VALUES(status),
  delete_flg = VALUES(delete_flg),
  updated_at = NOW();

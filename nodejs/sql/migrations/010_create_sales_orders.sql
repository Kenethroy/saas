USE `jrspc_node`;

CREATE TABLE IF NOT EXISTS sales_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sales_order_number VARCHAR(50) NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  order_date DATE NOT NULL,
  agent_id BIGINT UNSIGNED DEFAULT NULL,
  payment_term_id INT DEFAULT NULL,
  status ENUM('pending','processing','for_delivery','delivered','completed','cancelled') NOT NULL DEFAULT 'pending',
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
  CONSTRAINT uq_sales_orders_number UNIQUE (sales_order_number),
  INDEX idx_sales_orders_customer_id (customer_id),
  INDEX idx_sales_orders_agent_id (agent_id),
  INDEX idx_sales_orders_payment_term_id (payment_term_id),
  INDEX idx_sales_orders_status (status),
  INDEX idx_sales_orders_delete_flg (delete_flg),
  CONSTRAINT fk_sales_orders_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_sales_orders_agent_id FOREIGN KEY (agent_id) REFERENCES employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_sales_orders_payment_term_id FOREIGN KEY (payment_term_id) REFERENCES payment_terms(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sales_order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  product_variant_id BIGINT UNSIGNED NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  variant_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  unit_cost DECIMAL(15,2) NOT NULL,
  line_discount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  line_total DECIMAL(15,2) NOT NULL,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sales_order_items_sales_order_id (sales_order_id),
  INDEX idx_sales_order_items_product_id (product_id),
  INDEX idx_sales_order_items_product_variant_id (product_variant_id),
  CONSTRAINT fk_sales_order_items_sales_order_id FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_sales_order_items_product_id FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_sales_order_items_product_variant_id FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
);

INSERT INTO permissions (slug, name, description, status, delete_flg, created_at, updated_at)
VALUES
  ('salesOrders.view', 'View Sales Orders', 'Access sales order records and summaries', 1, 0, NOW(), NOW()),
  ('salesOrders.create', 'Create Sales Orders', 'Create new sales orders', 1, 0, NOW(), NOW()),
  ('salesOrders.update', 'Update Sales Orders', 'Edit existing sales orders', 1, 0, NOW(), NOW()),
  ('salesOrders.delete', 'Delete Sales Orders', 'Remove or cancel sales orders', 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  status = VALUES(status),
  delete_flg = VALUES(delete_flg),
  updated_at = NOW();

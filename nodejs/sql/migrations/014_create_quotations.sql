USE `jrspc_node`;

CREATE TABLE IF NOT EXISTS quotations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quote_number VARCHAR(50) NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  contact_person VARCHAR(255) DEFAULT NULL,
  quote_date DATE NOT NULL,
  valid_until DATE NOT NULL,
  payment_term_id INT DEFAULT NULL,
  agent_id BIGINT UNSIGNED DEFAULT NULL,
  status ENUM('draft','sent','accepted','rejected','expired','converted') NOT NULL DEFAULT 'draft',
  items_subtotal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  discount_type ENUM('none','percentage','fixed') NOT NULL DEFAULT 'none',
  discount_value DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  notes TEXT DEFAULT NULL,
  sales_order_id BIGINT UNSIGNED DEFAULT NULL,
  sent_at DATETIME NULL DEFAULT NULL,
  converted_at DATETIME NULL DEFAULT NULL,
  delete_flg TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_ip VARCHAR(45) DEFAULT NULL,
  updated_ip VARCHAR(45) DEFAULT NULL,
  CONSTRAINT uq_quotations_quote_number UNIQUE (quote_number),
  CONSTRAINT uq_quotations_sales_order_id UNIQUE (sales_order_id),
  INDEX idx_quotations_customer_id (customer_id),
  INDEX idx_quotations_payment_term_id (payment_term_id),
  INDEX idx_quotations_agent_id (agent_id),
  INDEX idx_quotations_status (status),
  INDEX idx_quotations_quote_date (quote_date),
  INDEX idx_quotations_valid_until (valid_until),
  INDEX idx_quotations_delete_flg (delete_flg),
  CONSTRAINT fk_quotations_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_quotations_payment_term_id FOREIGN KEY (payment_term_id) REFERENCES payment_terms(id) ON DELETE SET NULL,
  CONSTRAINT fk_quotations_agent_id FOREIGN KEY (agent_id) REFERENCES employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_quotations_sales_order_id FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quotation_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  product_variant_id BIGINT UNSIGNED NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  variant_name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  unit_cost DECIMAL(15,2) NOT NULL,
  line_discount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  line_total DECIMAL(15,2) NOT NULL,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_quotation_items_quotation_id (quotation_id),
  INDEX idx_quotation_items_product_id (product_id),
  INDEX idx_quotation_items_product_variant_id (product_variant_id),
  CONSTRAINT fk_quotation_items_quotation_id FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
  CONSTRAINT fk_quotation_items_product_id FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_quotation_items_product_variant_id FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
);

INSERT INTO permissions (slug, name, description, status, delete_flg, created_at, updated_at)
VALUES
  ('quotations.view', 'View Quotations', 'Access quotation records and summaries', 1, 0, NOW(), NOW()),
  ('quotations.create', 'Create Quotations', 'Create new quotations', 1, 0, NOW(), NOW()),
  ('quotations.update', 'Update Quotations', 'Edit quotation details and statuses', 1, 0, NOW(), NOW()),
  ('quotations.delete', 'Delete Quotations', 'Delete draft, rejected, or expired quotations', 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  status = VALUES(status),
  delete_flg = VALUES(delete_flg),
  updated_at = NOW();

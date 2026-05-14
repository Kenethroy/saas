USE `jrspc_node`;

CREATE TABLE IF NOT EXISTS deliveries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  delivery_number VARCHAR(50) NOT NULL,
  delivery_date DATE NOT NULL,
  driver_id BIGINT UNSIGNED DEFAULT NULL,
  truck_id BIGINT UNSIGNED DEFAULT NULL,
  status ENUM('pending','in_transit','delivered','cancelled') NOT NULL DEFAULT 'pending',
  notes TEXT DEFAULT NULL,
  departure_time DATETIME NULL DEFAULT NULL,
  completion_time DATETIME NULL DEFAULT NULL,
  delete_flg TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_ip VARCHAR(45) DEFAULT NULL,
  updated_ip VARCHAR(45) DEFAULT NULL,
  CONSTRAINT uq_deliveries_delivery_number UNIQUE (delivery_number),
  INDEX idx_deliveries_delivery_date (delivery_date),
  INDEX idx_deliveries_driver_id (driver_id),
  INDEX idx_deliveries_truck_id (truck_id),
  INDEX idx_deliveries_status (status),
  INDEX idx_deliveries_delete_flg (delete_flg),
  CONSTRAINT fk_deliveries_driver_id FOREIGN KEY (driver_id) REFERENCES employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_deliveries_truck_id FOREIGN KEY (truck_id) REFERENCES trucks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS delivery_sales_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  delivery_id BIGINT UNSIGNED NOT NULL,
  sales_order_id BIGINT UNSIGNED NOT NULL,
  sequence_order INT NOT NULL DEFAULT 1,
  delivery_status ENUM('pending','delivered','failed') NOT NULL DEFAULT 'pending',
  delivered_at DATETIME NULL DEFAULT NULL,
  delivery_notes TEXT DEFAULT NULL,
  recipient_name VARCHAR(255) DEFAULT NULL,
  recipient_signature VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_delivery_sales_orders_delivery_sales_order UNIQUE (delivery_id, sales_order_id),
  INDEX idx_delivery_sales_orders_delivery_id (delivery_id),
  INDEX idx_delivery_sales_orders_sales_order_id (sales_order_id),
  INDEX idx_delivery_sales_orders_delivery_status (delivery_status),
  CONSTRAINT fk_delivery_sales_orders_delivery_id FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
  CONSTRAINT fk_delivery_sales_orders_sales_order_id FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE
);

INSERT INTO permissions (slug, name, description, status, delete_flg, created_at, updated_at)
VALUES
  ('deliveries.view', 'View Deliveries', 'Access delivery schedules and delivery notes', 1, 0, NOW(), NOW()),
  ('deliveries.create', 'Create Deliveries', 'Create new delivery batches from sales orders', 1, 0, NOW(), NOW()),
  ('deliveries.update', 'Update Deliveries', 'Update delivery schedules and statuses', 1, 0, NOW(), NOW()),
  ('deliveries.delete', 'Delete Deliveries', 'Remove cancelled or pending deliveries', 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  status = VALUES(status),
  delete_flg = VALUES(delete_flg),
  updated_at = NOW();

USE `jrspc_node`;

-- Accounts Payable: tracks amounts owed to suppliers from received Purchase Orders
CREATE TABLE IF NOT EXISTS `accounts_payable` (
  `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `purchase_order_id`  BIGINT UNSIGNED NOT NULL,
  `supplier_id`        BIGINT UNSIGNED NOT NULL,
  `po_number`          VARCHAR(50)     NOT NULL,
  `receipt_date`       DATE            NOT NULL,
  `due_date`           DATE            DEFAULT NULL,
  `amount`             DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `paid_amount`        DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `outstanding_amount` DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  `status`             ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  `notes`              TEXT            DEFAULT NULL,
  `delete_flg`         TINYINT(1)      NOT NULL DEFAULT 0,
  `created_at`         DATETIME        NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME        NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip`         VARCHAR(45)     DEFAULT NULL,
  `updated_ip`         VARCHAR(45)     DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_accounts_payable_po_id` (`purchase_order_id`),
  KEY `idx_accounts_payable_supplier_id` (`supplier_id`),
  KEY `idx_accounts_payable_status` (`status`),
  KEY `idx_accounts_payable_due_date` (`due_date`),
  KEY `idx_accounts_payable_delete_flg` (`delete_flg`),
  CONSTRAINT `fk_accounts_payable_po_id`      FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`),
  CONSTRAINT `fk_accounts_payable_supplier_id` FOREIGN KEY (`supplier_id`)       REFERENCES `suppliers`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permissions
INSERT INTO permissions (slug, name, description, status, delete_flg, created_at, updated_at)
VALUES
  ('accountsPayable.view',   'View Accounts Payable',   'View supplier payable balances', 1, 0, NOW(), NOW()),
  ('accountsPayable.update', 'Update Accounts Payable', 'Edit notes and due dates on payable records', 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), updated_at = NOW();

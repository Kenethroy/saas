USE `jrspc_node`;

CREATE TABLE IF NOT EXISTS `accounts_receivable` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `invoice_id` BIGINT UNSIGNED DEFAULT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `agent_id` BIGINT UNSIGNED DEFAULT NULL,
  `invoice_date` DATE NOT NULL,
  `due_date` DATE DEFAULT NULL,
  `amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `paid_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `outstanding_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `is_opening_balance` TINYINT(1) NOT NULL DEFAULT 0,
  `status` ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_accounts_receivable_invoice_id` (`invoice_id`),
  KEY `idx_accounts_receivable_customer_id` (`customer_id`),
  KEY `idx_accounts_receivable_agent_id` (`agent_id`),
  KEY `idx_accounts_receivable_status` (`status`),
  KEY `idx_accounts_receivable_delete_flg` (`delete_flg`),
  CONSTRAINT `fk_accounts_receivable_invoice_id` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_accounts_receivable_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`),
  CONSTRAINT `fk_accounts_receivable_agent_id` FOREIGN KEY (`agent_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

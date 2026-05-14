USE `jrspc_node`;

CREATE TABLE IF NOT EXISTS `payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_number` VARCHAR(50) NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `payment_date` DATE NOT NULL,
  `payment_method` ENUM('cash', 'cheque', 'bank_transfer', 'credit_card', 'other') NOT NULL DEFAULT 'cash',
  `amount` DECIMAL(15,2) NOT NULL,
  `reference_number` VARCHAR(100) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `file_url` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payments_payment_number` (`payment_number`),
  KEY `idx_payments_customer_id` (`customer_id`),
  KEY `idx_payments_payment_date` (`payment_date`),
  CONSTRAINT `fk_payments_customer_id`
    FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_allocations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_id` BIGINT UNSIGNED NOT NULL,
  `accounts_receivable_id` BIGINT UNSIGNED NOT NULL,
  `amount_allocated` DECIMAL(15,2) NOT NULL,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_allocations_payment_ar` (`payment_id`, `accounts_receivable_id`),
  KEY `idx_payment_allocations_payment_id` (`payment_id`),
  KEY `idx_payment_allocations_accounts_receivable_id` (`accounts_receivable_id`),
  CONSTRAINT `fk_payment_allocations_payment_id`
    FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_allocations_accounts_receivable_id`
    FOREIGN KEY (`accounts_receivable_id`) REFERENCES `accounts_receivable`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `return_allocations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_return_id` BIGINT UNSIGNED NOT NULL,
  `accounts_receivable_id` BIGINT UNSIGNED NOT NULL,
  `amount_allocated` DECIMAL(15,2) NOT NULL,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_return_allocations_return_ar` (`customer_return_id`, `accounts_receivable_id`),
  KEY `idx_return_allocations_customer_return_id` (`customer_return_id`),
  KEY `idx_return_allocations_accounts_receivable_id` (`accounts_receivable_id`),
  CONSTRAINT `fk_return_allocations_customer_return_id`
    FOREIGN KEY (`customer_return_id`) REFERENCES `customer_returns`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_return_allocations_accounts_receivable_id`
    FOREIGN KEY (`accounts_receivable_id`) REFERENCES `accounts_receivable`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `permissions` (`slug`, `name`, `description`) VALUES
  ('payments.create', 'Create Customer Payments', 'Allow users to record customer payments')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);

INSERT INTO `role_permissions` (`role`, `permission_id`)
SELECT 'admin', `id`
FROM `permissions`
WHERE `slug` = 'payments.create'
ON DUPLICATE KEY UPDATE `permission_id` = VALUES(`permission_id`);

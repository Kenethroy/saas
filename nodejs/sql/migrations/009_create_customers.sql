USE `jrspc_node`;

CREATE TABLE IF NOT EXISTS `customers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NULL,
  `phone` VARCHAR(50) NULL,
  `company` VARCHAR(255) NULL,
  `address` TEXT NULL,
  `payment_term_id` INT NULL,
  `status` TINYINT(1) NOT NULL DEFAULT 1,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customers_email` (`email`),
  KEY `idx_customers_payment_term_id` (`payment_term_id`),
  KEY `idx_customers_status` (`status`),
  KEY `idx_customers_delete_flg` (`delete_flg`),
  CONSTRAINT `fk_customers_payment_term_id`
    FOREIGN KEY (`payment_term_id`) REFERENCES `payment_terms` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

USE `jrspc_node`;

CREATE TABLE IF NOT EXISTS `supplier_payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_number` VARCHAR(50) NOT NULL,
  `supplier_id` BIGINT UNSIGNED NOT NULL,
  `accounts_payable_id` BIGINT UNSIGNED NOT NULL,
  `payment_date` DATE NOT NULL,
  `payment_method` ENUM('cash', 'cheque', 'bank_transfer', 'credit_card', 'other') NOT NULL DEFAULT 'cash',
  `amount` DECIMAL(15,2) NOT NULL,
  `reference_number` VARCHAR(100) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `file_url` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NULL DEFAULT NULL,
  `updated_at` DATETIME NULL DEFAULT NULL,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_supplier_payments_payment_number` (`payment_number`),
  KEY `idx_supplier_payments_supplier_id` (`supplier_id`),
  KEY `idx_supplier_payments_accounts_payable_id` (`accounts_payable_id`),
  KEY `idx_supplier_payments_payment_date` (`payment_date`),
  CONSTRAINT `fk_supplier_payments_supplier_id`
    FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_supplier_payments_accounts_payable_id`
    FOREIGN KEY (`accounts_payable_id`) REFERENCES `accounts_payable`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TRIGGER IF EXISTS `trg_supplier_payments_before_insert`;
DROP TRIGGER IF EXISTS `trg_supplier_payments_before_update`;

DELIMITER $$

CREATE TRIGGER `trg_supplier_payments_before_insert`
BEFORE INSERT ON `supplier_payments`
FOR EACH ROW
BEGIN
  IF NEW.`created_at` IS NULL THEN
    SET NEW.`created_at` = CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00');
  END IF;

  IF NEW.`updated_at` IS NULL THEN
    SET NEW.`updated_at` = CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00');
  END IF;
END$$

CREATE TRIGGER `trg_supplier_payments_before_update`
BEFORE UPDATE ON `supplier_payments`
FOR EACH ROW
BEGIN
  SET NEW.`updated_at` = CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00');
END$$

DELIMITER ;

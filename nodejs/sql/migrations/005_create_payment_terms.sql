USE `jrspc_node`;

CREATE TABLE IF NOT EXISTS `payment_terms` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `days` INT NOT NULL DEFAULT 0,
  `status` TINYINT(1) NOT NULL DEFAULT 1,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_terms_name` (`name`),
  KEY `idx_payment_terms_status` (`status`),
  KEY `idx_payment_terms_delete_flg` (`delete_flg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `permissions` (`slug`, `name`, `description`) VALUES
  ('paymentTerms.view', 'View Payment Terms', 'Allow users to view payment terms'),
  ('paymentTerms.create', 'Create Payment Terms', 'Allow users to create payment terms'),
  ('paymentTerms.update', 'Update Payment Terms', 'Allow users to update payment terms'),
  ('paymentTerms.delete', 'Delete Payment Terms', 'Allow users to delete payment terms')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);

INSERT INTO `payment_terms` (`name`, `days`) VALUES
  ('Cash on Delivery', 0),
  ('Due on Receipt', 0),
  ('Net 15 Days', 15),
  ('Net 30 Days', 30),
  ('Net 60 Days', 60)
ON DUPLICATE KEY UPDATE
  `days` = VALUES(`days`);

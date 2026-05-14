-- Create suppliers table

USE `jrspc_node`;

CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `company_name` varchar(255) DEFAULT NULL,
  `contact_person` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `address` text,
  `payment_term_id` bigint(20) unsigned DEFAULT NULL,
  `status` tinyint(4) NOT NULL DEFAULT '1',
  `delete_flg` tinyint(1) NOT NULL DEFAULT '0',
  `created` datetime DEFAULT CURRENT_TIMESTAMP,
  `modified` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` varchar(45) DEFAULT NULL,
  `modified_ip` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_suppliers_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO permissions (slug, name, description, status, delete_flg, created_at, updated_at)
VALUES
  ('suppliers.view', 'View Suppliers', 'Access supplier records and summaries', 1, 0, NOW(), NOW()),
  ('suppliers.create', 'Create Suppliers', 'Create new suppliers', 1, 0, NOW(), NOW()),
  ('suppliers.update', 'Update Suppliers', 'Edit existing suppliers', 1, 0, NOW(), NOW()),
  ('suppliers.delete', 'Delete Suppliers', 'Remove or disable suppliers', 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  status = VALUES(status),
  delete_flg = VALUES(delete_flg),
  updated_at = NOW();

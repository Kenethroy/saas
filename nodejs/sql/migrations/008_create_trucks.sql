USE `jrspc_node`;

CREATE TABLE IF NOT EXISTS `trucks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `plate_number` VARCHAR(50) NOT NULL,
  `model` VARCHAR(100) NULL,
  `brand` VARCHAR(100) NULL,
  `year` INT NULL,
  `color` VARCHAR(50) NULL,
  `capacity_kg` DECIMAL(10,2) NULL,
  `status` ENUM('active', 'inactive', 'maintenance') NOT NULL DEFAULT 'active',
  `notes` TEXT NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trucks_plate_number` (`plate_number`),
  KEY `idx_trucks_status` (`status`),
  KEY `idx_trucks_delete_flg` (`delete_flg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `permissions` (`slug`, `name`, `description`) VALUES
  ('trucks.view', 'View Trucks', 'Allow users to view trucks'),
  ('trucks.create', 'Create Trucks', 'Allow users to create trucks'),
  ('trucks.update', 'Update Trucks', 'Allow users to update trucks'),
  ('trucks.delete', 'Delete Trucks', 'Allow users to delete trucks')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);

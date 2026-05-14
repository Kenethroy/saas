USE `jrspc_node`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'staff', 'agent', 'driver') NOT NULL DEFAULT 'staff',
  `status` TINYINT(1) NOT NULL DEFAULT 1,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `last_login_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_status` (`status`),
  KEY `idx_users_delete_flg` (`delete_flg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `employees` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `position` VARCHAR(50) NOT NULL COMMENT 'agent, driver, pahinante, staff',
  `phone` VARCHAR(20) NULL,
  `email` VARCHAR(100) NULL,
  `status` ENUM('active', 'inactive', 'on_leave') NOT NULL DEFAULT 'active',
  `address` TEXT NULL,
  `license_number` VARCHAR(50) NULL,
  `license_expiry` DATE NULL,
  `emergency_contact_name` VARCHAR(100) NULL,
  `emergency_contact_phone` VARCHAR(20) NULL,
  `date_hired` DATE NULL,
  `salary_rate` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `rate_type` ENUM('Monthly', 'Daily', 'Per Trip') NOT NULL DEFAULT 'Daily',
  `sss_no` VARCHAR(20) NULL,
  `tin_no` VARCHAR(20) NULL,
  `philhealth_no` VARCHAR(20) NULL,
  `pagibig_no` VARCHAR(20) NULL,
  `user_id` BIGINT UNSIGNED NULL,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_employees_email` (`email`),
  UNIQUE KEY `uq_employees_user_id` (`user_id`),
  KEY `idx_employees_status` (`status`),
  KEY `idx_employees_delete_flg` (`delete_flg`),
  CONSTRAINT `fk_employees_user_id`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `token` VARCHAR(512) NOT NULL,
  `token_hash` CHAR(64) NULL,
  `device_id` VARCHAR(128) NULL,
  `device_name` VARCHAR(128) NULL,
  `platform` VARCHAR(64) NULL,
  `user_agent` VARCHAR(255) NULL,
  `ip_address` VARCHAR(45) NULL,
  `last_seen_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NULL,
  `revoked_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_sessions_token` (`token`),
  UNIQUE KEY `uq_user_sessions_token_hash` (`token_hash`),
  KEY `idx_user_sessions_user_id` (`user_id`),
  KEY `idx_user_sessions_device_id` (`device_id`),
  KEY `idx_user_sessions_active` (`user_id`, `revoked_at`, `expires_at`),
  CONSTRAINT `fk_user_sessions_user_id`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `status` TINYINT(1) NOT NULL DEFAULT 1,
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permissions_slug` (`slug`),
  KEY `idx_permissions_status` (`status`),
  KEY `idx_permissions_delete_flg` (`delete_flg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `role` ENUM('admin', 'staff', 'agent', 'driver') NOT NULL,
  `permission_id` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_role_permissions_role_permission_id` (`role`, `permission_id`),
  KEY `idx_role_permissions_role` (`role`),
  KEY `idx_role_permissions_permission_id` (`permission_id`),
  CONSTRAINT `fk_role_permissions_permission_id`
    FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_permissions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `permission_id` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_ip` VARCHAR(45) NULL,
  `updated_ip` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_permissions_user_permission_id` (`user_id`, `permission_id`),
  KEY `idx_user_permissions_user_id` (`user_id`),
  KEY `idx_user_permissions_permission_id` (`permission_id`),
  CONSTRAINT `fk_user_permissions_user_id`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_user_permissions_permission_id`
    FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `permissions` (`slug`, `name`, `description`) VALUES
  ('employees.view', 'View Employees', 'Allow users to view employee records'),
  ('employees.create', 'Create Employees', 'Allow users to create employee records'),
  ('employees.update', 'Update Employees', 'Allow users to update employee records'),
  ('employees.delete', 'Delete Employees', 'Allow users to archive employee records'),
  ('users.view', 'View Users', 'Allow users to view system users'),
  ('users.create', 'Create Users', 'Allow users to create system users'),
  ('users.update', 'Update Users', 'Allow users to update system users'),
  ('users.permissions.manage', 'Manage User Permissions', 'Allow users to manage roles and permissions')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);

INSERT INTO `role_permissions` (`role`, `permission_id`)
SELECT 'admin', `id`
FROM `permissions`
ON DUPLICATE KEY UPDATE `permission_id` = VALUES(`permission_id`);

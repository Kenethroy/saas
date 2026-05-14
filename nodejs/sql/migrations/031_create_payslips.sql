USE `jrspc_node`;

CREATE TABLE IF NOT EXISTS `payslips` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payslip_number` VARCHAR(50) NOT NULL,
  `employee_id` BIGINT UNSIGNED NOT NULL,
  `period_start` DATE NOT NULL,
  `period_end` DATE NOT NULL,
  `pay_date` DATE NOT NULL,
  `gross_pay` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `total_deductions` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `net_pay` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `notes` TEXT DEFAULT NULL,
  `metadata` JSON DEFAULT NULL,
  `status` ENUM('draft', 'released') NOT NULL DEFAULT 'draft',
  `delete_flg` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NULL DEFAULT NULL,
  `updated_at` DATETIME NULL DEFAULT NULL,
  `created_ip` VARCHAR(45) DEFAULT NULL,
  `updated_ip` VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payslips_payslip_number` (`payslip_number`),
  KEY `idx_payslips_employee_id` (`employee_id`),
  KEY `idx_payslips_pay_date` (`pay_date`),
  CONSTRAINT `fk_payslips_employee_id`
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permissions (admin will get automatically; assign to other roles as needed)
INSERT IGNORE INTO `permissions` (`slug`, `description`, `status`, `delete_flg`)
VALUES
  ('payslips.view', 'View payslips', 1, 0),
  ('payslips.create', 'Create payslips', 1, 0),
  ('payslips.update', 'Update payslips', 1, 0),
  ('payslips.delete', 'Delete payslips', 1, 0);


USE `saas`;

CREATE TABLE IF NOT EXISTS `subscription_plan_prices` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `plan_id` BIGINT UNSIGNED NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `checkout_mode` ENUM('subscription', 'payment') NOT NULL DEFAULT 'subscription',
  `billing_interval_unit` ENUM('month', 'year') NOT NULL,
  `billing_interval_count` INT UNSIGNED NOT NULL DEFAULT 1,
  `price` DECIMAL(12, 2) NULL,
  `currency_code` VARCHAR(10) NOT NULL DEFAULT 'PHP',
  `provider_price_id` VARCHAR(255) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subscription_plan_prices_code` (`code`),
  UNIQUE KEY `uq_subscription_plan_prices_plan_term_currency` (`plan_id`, `billing_interval_unit`, `billing_interval_count`, `currency_code`),
  KEY `idx_subscription_plan_prices_plan_active` (`plan_id`, `is_active`),
  CONSTRAINT `fk_subscription_plan_prices_plan_id`
    FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS `sp_migrate_add_subscription_plan_prices`;

DELIMITER $$

CREATE PROCEDURE `sp_migrate_add_subscription_plan_prices`()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'saas'
      AND TABLE_NAME = 'subscriptions'
      AND COLUMN_NAME = 'plan_price_id'
  ) THEN
    ALTER TABLE `subscriptions`
      ADD COLUMN `plan_price_id` BIGINT UNSIGNED NULL AFTER `plan_id`;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'saas'
      AND TABLE_NAME = 'subscriptions'
      AND INDEX_NAME = 'idx_subscriptions_plan_price_id'
  ) THEN
    ALTER TABLE `subscriptions`
      ADD KEY `idx_subscriptions_plan_price_id` (`plan_price_id`);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = 'saas'
      AND CONSTRAINT_NAME = 'fk_subscriptions_plan_price_id'
  ) THEN
    ALTER TABLE `subscriptions`
      ADD CONSTRAINT `fk_subscriptions_plan_price_id`
        FOREIGN KEY (`plan_price_id`) REFERENCES `subscription_plan_prices` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
  END IF;
END$$

DELIMITER ;

CALL `sp_migrate_add_subscription_plan_prices`();

DROP PROCEDURE IF EXISTS `sp_migrate_add_subscription_plan_prices`;

INSERT INTO `subscription_plan_prices` (
  `plan_id`,
  `code`,
  `name`,
  `description`,
  `checkout_mode`,
  `billing_interval_unit`,
  `billing_interval_count`,
  `price`,
  `currency_code`,
  `provider_price_id`,
  `is_active`,
  `created_at`,
  `updated_at`
) VALUES
  ((SELECT `id` FROM `subscription_plans` WHERE `code` = 'starter' LIMIT 1), 'starter-monthly', 'Starter Monthly', 'Starter plan billed every month.', 'subscription', 'month', 1, 999.00, 'PHP', NULL, 1, NOW(), NOW()),
  ((SELECT `id` FROM `subscription_plans` WHERE `code` = 'starter' LIMIT 1), 'starter-1y', 'Starter 1 Year', 'Starter plan billed every 1 year.', 'subscription', 'year', 1, 9990.00, 'PHP', NULL, 1, NOW(), NOW()),
  ((SELECT `id` FROM `subscription_plans` WHERE `code` = 'starter' LIMIT 1), 'starter-2y', 'Starter 2 Years', 'Starter plan billed every 2 years.', 'subscription', 'year', 2, 19980.00, 'PHP', NULL, 1, NOW(), NOW()),
  ((SELECT `id` FROM `subscription_plans` WHERE `code` = 'starter' LIMIT 1), 'starter-4y', 'Starter 4 Years', 'Starter plan prepaid for 4 years.', 'payment', 'year', 4, 39960.00, 'PHP', NULL, 1, NOW(), NOW()),
  ((SELECT `id` FROM `subscription_plans` WHERE `code` = 'pro' LIMIT 1), 'pro-monthly', 'Pro Monthly', 'Pro plan billed every month.', 'subscription', 'month', 1, 2999.00, 'PHP', NULL, 1, NOW(), NOW()),
  ((SELECT `id` FROM `subscription_plans` WHERE `code` = 'pro' LIMIT 1), 'pro-1y', 'Pro 1 Year', 'Pro plan billed every 1 year.', 'subscription', 'year', 1, 29990.00, 'PHP', NULL, 1, NOW(), NOW()),
  ((SELECT `id` FROM `subscription_plans` WHERE `code` = 'pro' LIMIT 1), 'pro-2y', 'Pro 2 Years', 'Pro plan billed every 2 years.', 'subscription', 'year', 2, 59980.00, 'PHP', NULL, 1, NOW(), NOW()),
  ((SELECT `id` FROM `subscription_plans` WHERE `code` = 'pro' LIMIT 1), 'pro-4y', 'Pro 4 Years', 'Pro plan prepaid for 4 years.', 'payment', 'year', 4, 119960.00, 'PHP', NULL, 1, NOW(), NOW()),
  ((SELECT `id` FROM `subscription_plans` WHERE `code` = 'enterprise' LIMIT 1), 'enterprise-monthly', 'Enterprise Monthly', 'Enterprise monthly term; pricing is manual.', 'subscription', 'month', 1, NULL, 'PHP', NULL, 1, NOW(), NOW()),
  ((SELECT `id` FROM `subscription_plans` WHERE `code` = 'enterprise' LIMIT 1), 'enterprise-1y', 'Enterprise 1 Year', 'Enterprise 1 year term; pricing is manual.', 'subscription', 'year', 1, NULL, 'PHP', NULL, 1, NOW(), NOW()),
  ((SELECT `id` FROM `subscription_plans` WHERE `code` = 'enterprise' LIMIT 1), 'enterprise-2y', 'Enterprise 2 Years', 'Enterprise 2 year term; pricing is manual.', 'subscription', 'year', 2, NULL, 'PHP', NULL, 1, NOW(), NOW()),
  ((SELECT `id` FROM `subscription_plans` WHERE `code` = 'enterprise' LIMIT 1), 'enterprise-4y', 'Enterprise 4 Years', 'Enterprise 4 year term; pricing is manual.', 'payment', 'year', 4, NULL, 'PHP', NULL, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `checkout_mode` = VALUES(`checkout_mode`),
  `billing_interval_unit` = VALUES(`billing_interval_unit`),
  `billing_interval_count` = VALUES(`billing_interval_count`),
  `price` = VALUES(`price`),
  `currency_code` = VALUES(`currency_code`),
  `provider_price_id` = VALUES(`provider_price_id`),
  `is_active` = VALUES(`is_active`),
  `updated_at` = NOW();

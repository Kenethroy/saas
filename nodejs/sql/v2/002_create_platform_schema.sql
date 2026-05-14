USE `saas`;

CREATE TABLE IF NOT EXISTS `accounts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(100) NULL,
  `last_name` VARCHAR(100) NULL,
  `status` ENUM('pending', 'active', 'suspended', 'deleted') NOT NULL DEFAULT 'pending',
  `email_verified_at` DATETIME NULL,
  `last_login_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_accounts_email` (`email`),
  KEY `idx_accounts_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `platform_account_roles` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `account_id` BIGINT UNSIGNED NOT NULL,
  `role` ENUM('platform_super_admin', 'platform_support', 'billing_admin') NOT NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_platform_account_roles_account_role` (`account_id`, `role`),
  KEY `idx_platform_account_roles_role` (`role`),
  CONSTRAINT `fk_platform_account_roles_account_id`
    FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenants` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `legal_name` VARCHAR(255) NULL,
  `business_type` VARCHAR(100) NULL,
  `address` TEXT NULL,
  `phone` VARCHAR(50) NULL,
  `email` VARCHAR(255) NULL,
  `logo_path` VARCHAR(255) NULL,
  `currency_code` VARCHAR(10) NOT NULL DEFAULT 'PHP',
  `timezone` VARCHAR(100) NOT NULL DEFAULT 'Asia/Manila',
  `status` ENUM('pending', 'active', 'inactive', 'suspended', 'cancelled') NOT NULL DEFAULT 'pending',
  `subscription_status` ENUM('incomplete', 'trialing', 'active', 'past_due', 'expired', 'cancelled', 'suspended') NOT NULL DEFAULT 'incomplete',
  `primary_owner_account_id` BIGINT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenants_uuid` (`uuid`),
  UNIQUE KEY `uq_tenants_slug` (`slug`),
  KEY `idx_tenants_status` (`status`),
  KEY `idx_tenants_subscription_status` (`subscription_status`),
  KEY `idx_tenants_primary_owner_account_id` (`primary_owner_account_id`),
  CONSTRAINT `fk_tenants_primary_owner_account_id`
    FOREIGN KEY (`primary_owner_account_id`) REFERENCES `accounts` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenant_memberships` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `account_id` BIGINT UNSIGNED NOT NULL,
  `role` ENUM('owner', 'admin', 'member', 'viewer') NOT NULL DEFAULT 'member',
  `status` ENUM('pending', 'active', 'invited', 'suspended', 'revoked') NOT NULL DEFAULT 'active',
  `joined_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_memberships_tenant_account` (`tenant_id`, `account_id`),
  KEY `idx_tenant_memberships_account_id` (`account_id`),
  KEY `idx_tenant_memberships_role` (`role`),
  KEY `idx_tenant_memberships_status` (`status`),
  CONSTRAINT `fk_tenant_memberships_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_tenant_memberships_account_id`
    FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `branches` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `type` ENUM('main', 'branch') NOT NULL DEFAULT 'branch',
  `is_primary` TINYINT(1) NOT NULL DEFAULT 0,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `phone` VARCHAR(50) NULL,
  `email` VARCHAR(255) NULL,
  `address` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_branches_tenant_code` (`tenant_id`, `code`),
  KEY `idx_branches_tenant_primary` (`tenant_id`, `is_primary`),
  CONSTRAINT `fk_branches_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `subscription_plans` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `price_monthly` DECIMAL(12, 2) NULL,
  `price_yearly` DECIMAL(12, 2) NULL,
  `max_branches` INT NULL,
  `max_users` INT NULL,
  `max_products` INT NULL,
  `max_storage_gb` INT NULL,
  `allow_reports` TINYINT(1) NOT NULL DEFAULT 0,
  `allow_backup` TINYINT(1) NOT NULL DEFAULT 0,
  `allow_api_access` TINYINT(1) NOT NULL DEFAULT 0,
  `allow_multi_branch` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subscription_plans_code` (`code`),
  KEY `idx_subscription_plans_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `plan_id` BIGINT UNSIGNED NOT NULL,
  `provider` ENUM('manual', 'stripe', 'paymongo', 'xendit', 'paddle') NOT NULL DEFAULT 'manual',
  `provider_subscription_id` VARCHAR(255) NULL,
  `status` ENUM('incomplete', 'trialing', 'active', 'past_due', 'expired', 'cancelled', 'suspended') NOT NULL DEFAULT 'incomplete',
  `billing_cycle` ENUM('monthly', 'yearly', 'custom') NOT NULL DEFAULT 'monthly',
  `started_at` DATETIME NULL,
  `current_period_start` DATETIME NULL,
  `current_period_end` DATETIME NULL,
  `cancel_at_period_end` TINYINT(1) NOT NULL DEFAULT 0,
  `cancelled_at` DATETIME NULL,
  `metadata_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subscriptions_provider_subscription` (`provider`, `provider_subscription_id`),
  KEY `idx_subscriptions_tenant_status` (`tenant_id`, `status`),
  KEY `idx_subscriptions_plan_id` (`plan_id`),
  CONSTRAINT `fk_subscriptions_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_subscriptions_plan_id`
    FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `billing_invoices` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `subscription_id` BIGINT UNSIGNED NOT NULL,
  `invoice_number` VARCHAR(100) NOT NULL,
  `amount_due` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `amount_paid` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'PHP',
  `status` ENUM('draft', 'open', 'paid', 'void', 'uncollectible') NOT NULL DEFAULT 'open',
  `due_at` DATETIME NULL,
  `paid_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_billing_invoices_tenant_invoice_number` (`tenant_id`, `invoice_number`),
  KEY `idx_billing_invoices_subscription_id` (`subscription_id`),
  CONSTRAINT `fk_billing_invoices_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_billing_invoices_subscription_id`
    FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `subscription_payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `subscription_id` BIGINT UNSIGNED NOT NULL,
  `billing_invoice_id` BIGINT UNSIGNED NULL,
  `provider` ENUM('manual', 'stripe', 'paymongo', 'xendit', 'paddle') NOT NULL DEFAULT 'manual',
  `provider_payment_id` VARCHAR(255) NULL,
  `provider_reference` VARCHAR(255) NULL,
  `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'PHP',
  `status` ENUM('pending', 'paid', 'failed', 'refunded', 'voided') NOT NULL DEFAULT 'pending',
  `paid_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subscription_payments_provider_payment` (`provider`, `provider_payment_id`),
  KEY `idx_subscription_payments_subscription_id` (`subscription_id`),
  CONSTRAINT `fk_subscription_payments_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_subscription_payments_subscription_id`
    FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_subscription_payments_billing_invoice_id`
    FOREIGN KEY (`billing_invoice_id`) REFERENCES `billing_invoices` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `provider_customers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `account_id` BIGINT UNSIGNED NULL,
  `provider` ENUM('stripe', 'paymongo', 'xendit', 'paddle') NOT NULL,
  `provider_customer_id` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NULL,
  `metadata_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_provider_customers_provider_customer` (`provider`, `provider_customer_id`),
  UNIQUE KEY `uq_provider_customers_tenant_provider` (`tenant_id`, `provider`),
  CONSTRAINT `fk_provider_customers_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_provider_customers_account_id`
    FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `provider_subscriptions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `subscription_id` BIGINT UNSIGNED NOT NULL,
  `provider` ENUM('stripe', 'paymongo', 'xendit', 'paddle') NOT NULL,
  `provider_subscription_id` VARCHAR(255) NOT NULL,
  `provider_plan_id` VARCHAR(255) NULL,
  `status` VARCHAR(50) NULL,
  `payload_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_provider_subscriptions_provider_subscription` (`provider`, `provider_subscription_id`),
  UNIQUE KEY `uq_provider_subscriptions_subscription_provider` (`subscription_id`, `provider`),
  CONSTRAINT `fk_provider_subscriptions_subscription_id`
    FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `provider_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `provider` ENUM('stripe', 'paymongo', 'xendit', 'paddle') NOT NULL,
  `event_id` VARCHAR(255) NOT NULL,
  `event_type` VARCHAR(100) NOT NULL,
  `tenant_id` BIGINT UNSIGNED NULL,
  `subscription_id` BIGINT UNSIGNED NULL,
  `payload_json` JSON NOT NULL,
  `processed_at` DATETIME NULL,
  `status` ENUM('pending', 'processed', 'ignored', 'failed') NOT NULL DEFAULT 'pending',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_provider_events_provider_event` (`provider`, `event_id`),
  KEY `idx_provider_events_status` (`status`),
  CONSTRAINT `fk_provider_events_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_provider_events_subscription_id`
    FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenant_domains` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `domain` VARCHAR(255) NOT NULL,
  `subdomain` VARCHAR(100) NULL,
  `type` ENUM('subdomain', 'custom') NOT NULL DEFAULT 'subdomain',
  `is_primary` TINYINT(1) NOT NULL DEFAULT 1,
  `status` ENUM('pending', 'verified', 'active', 'failed', 'redirected') NOT NULL DEFAULT 'pending',
  `verification_token` VARCHAR(255) NULL,
  `verified_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_domains_domain` (`domain`),
  UNIQUE KEY `uq_tenant_domains_subdomain` (`subdomain`),
  KEY `idx_tenant_domains_tenant_primary` (`tenant_id`, `is_primary`),
  CONSTRAINT `fk_tenant_domains_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenant_onboarding` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NULL,
  `account_id` BIGINT UNSIGNED NOT NULL,
  `preferred_subdomain` VARCHAR(100) NULL,
  `current_step` ENUM('account', 'business_info', 'plan', 'payment', 'activation', 'completed') NOT NULL DEFAULT 'account',
  `business_info_completed_at` DATETIME NULL,
  `plan_selected_at` DATETIME NULL,
  `payment_completed_at` DATETIME NULL,
  `webhook_confirmed_at` DATETIME NULL,
  `tenant_created_at` DATETIME NULL,
  `admin_created_at` DATETIME NULL,
  `completed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_onboarding_account_id` (`account_id`),
  CONSTRAINT `fk_tenant_onboarding_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_tenant_onboarding_account_id`
    FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenant_subdomain_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `old_subdomain` VARCHAR(100) NOT NULL,
  `new_subdomain` VARCHAR(100) NOT NULL,
  `changed_by_account_id` BIGINT UNSIGNED NULL,
  `changed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_subdomain_history_tenant_id` (`tenant_id`),
  CONSTRAINT `fk_tenant_subdomain_history_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_tenant_subdomain_history_changed_by_account_id`
    FOREIGN KEY (`changed_by_account_id`) REFERENCES `accounts` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenant_invitations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `role` ENUM('owner', 'admin', 'member', 'viewer') NOT NULL DEFAULT 'member',
  `token` VARCHAR(255) NOT NULL,
  `status` ENUM('pending', 'accepted', 'expired', 'revoked') NOT NULL DEFAULT 'pending',
  `invited_by_account_id` BIGINT UNSIGNED NULL,
  `accepted_by_account_id` BIGINT UNSIGNED NULL,
  `expires_at` DATETIME NULL,
  `accepted_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_invitations_token` (`token`),
  UNIQUE KEY `uq_tenant_invitations_tenant_email_pending` (`tenant_id`, `email`, `status`),
  KEY `idx_tenant_invitations_invited_by_account_id` (`invited_by_account_id`),
  KEY `idx_tenant_invitations_accepted_by_account_id` (`accepted_by_account_id`),
  CONSTRAINT `fk_tenant_invitations_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_tenant_invitations_invited_by_account_id`
    FOREIGN KEY (`invited_by_account_id`) REFERENCES `accounts` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_tenant_invitations_accepted_by_account_id`
    FOREIGN KEY (`accepted_by_account_id`) REFERENCES `accounts` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `account_email_verifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `account_id` BIGINT UNSIGNED NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `status` ENUM('pending', 'verified', 'expired', 'revoked') NOT NULL DEFAULT 'pending',
  `expires_at` DATETIME NULL,
  `verified_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_account_email_verifications_token` (`token`),
  KEY `idx_account_email_verifications_account_status` (`account_id`, `status`),
  CONSTRAINT `fk_account_email_verifications_account_id`
    FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `account_id` BIGINT UNSIGNED NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `status` ENUM('pending', 'used', 'expired', 'revoked') NOT NULL DEFAULT 'pending',
  `expires_at` DATETIME NULL,
  `used_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_password_reset_tokens_token` (`token`),
  KEY `idx_password_reset_tokens_account_status` (`account_id`, `status`),
  CONSTRAINT `fk_password_reset_tokens_account_id`
    FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenant_feature_overrides` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `feature_key` VARCHAR(100) NOT NULL,
  `value_type` ENUM('boolean', 'integer', 'decimal', 'string', 'json') NOT NULL,
  `value_boolean` TINYINT(1) NULL,
  `value_integer` BIGINT NULL,
  `value_decimal` DECIMAL(15, 2) NULL,
  `value_string` VARCHAR(255) NULL,
  `value_json` JSON NULL,
  `reason` VARCHAR(255) NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `effective_from` DATETIME NULL,
  `effective_until` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_feature_overrides_tenant_feature` (`tenant_id`, `feature_key`),
  KEY `idx_tenant_feature_overrides_status` (`status`),
  CONSTRAINT `fk_tenant_feature_overrides_tenant_id`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `app_reserved_subdomains` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `reason` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_app_reserved_subdomains_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

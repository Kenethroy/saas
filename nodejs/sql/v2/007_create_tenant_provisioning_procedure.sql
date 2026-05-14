USE `saas`;

DROP PROCEDURE IF EXISTS `sp_provision_tenant`;

DELIMITER $$

CREATE PROCEDURE `sp_provision_tenant`(
  IN p_account_id BIGINT UNSIGNED,
  IN p_plan_code VARCHAR(50),
  IN p_provider VARCHAR(50),
  IN p_provider_subscription_id VARCHAR(255),
  IN p_subscription_status VARCHAR(50),
  IN p_billing_cycle VARCHAR(20),
  IN p_business_name VARCHAR(255),
  IN p_legal_name VARCHAR(255),
  IN p_business_type VARCHAR(100),
  IN p_phone VARCHAR(50),
  IN p_business_email VARCHAR(255),
  IN p_address TEXT,
  IN p_currency_code VARCHAR(10),
  IN p_timezone VARCHAR(100),
  IN p_subdomain VARCHAR(100),
  IN p_base_domain VARCHAR(255),
  IN p_owner_username VARCHAR(100),
  IN p_primary_branch_name VARCHAR(150)
)
BEGIN
  DECLARE v_account_email VARCHAR(255);
  DECLARE v_account_password_hash VARCHAR(255);
  DECLARE v_account_first_name VARCHAR(100);
  DECLARE v_account_last_name VARCHAR(100);
  DECLARE v_plan_id BIGINT UNSIGNED;
  DECLARE v_tenant_id BIGINT UNSIGNED;
  DECLARE v_branch_id BIGINT UNSIGNED;
  DECLARE v_user_id BIGINT UNSIGNED;
  DECLARE v_domain VARCHAR(255);
  DECLARE v_subdomain VARCHAR(100);
  DECLARE v_username VARCHAR(100);
  DECLARE v_tenant_status VARCHAR(20);
  DECLARE v_subscription_status_normalized VARCHAR(50);
  DECLARE v_billing_cycle_normalized VARCHAR(20);
  DECLARE v_branch_name VARCHAR(150);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET v_subdomain = LOWER(TRIM(p_subdomain));
  SET v_username = TRIM(p_owner_username);
  SET v_branch_name = COALESCE(NULLIF(TRIM(p_primary_branch_name), ''), 'Main Branch');
  SET v_subscription_status_normalized = LOWER(TRIM(COALESCE(p_subscription_status, 'active')));
  SET v_billing_cycle_normalized = LOWER(TRIM(COALESCE(p_billing_cycle, 'monthly')));

  IF v_subdomain IS NULL OR v_subdomain = '' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Subdomain is required';
  END IF;

  IF v_subdomain NOT REGEXP '^[a-z0-9-]{3,50}$' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Subdomain format is invalid';
  END IF;

  IF v_username IS NULL OR v_username = '' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Owner username is required';
  END IF;

  IF p_business_name IS NULL OR TRIM(p_business_name) = '' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Business name is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM `accounts`
    WHERE `id` = p_account_id
      AND `status` IN ('pending', 'active')
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Account not found or inactive';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM `app_reserved_subdomains`
    WHERE `name` = v_subdomain
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Subdomain is reserved';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM `tenant_domains`
    WHERE `subdomain` = v_subdomain
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Subdomain already exists';
  END IF;

  SELECT `id`
  INTO v_plan_id
  FROM `subscription_plans`
  WHERE `code` = p_plan_code
    AND `is_active` = 1
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Subscription plan not found';
  END IF;

  SELECT
    `email`,
    `password_hash`,
    `first_name`,
    `last_name`
  INTO
    v_account_email,
    v_account_password_hash,
    v_account_first_name,
    v_account_last_name
  FROM `accounts`
  WHERE `id` = p_account_id
  LIMIT 1;

  IF p_base_domain IS NOT NULL AND TRIM(p_base_domain) <> '' THEN
    SET v_domain = CONCAT(v_subdomain, '.', LOWER(TRIM(p_base_domain)));
  ELSE
    SET v_domain = v_subdomain;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM `tenant_domains`
    WHERE `domain` = v_domain
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tenant domain already exists';
  END IF;

  IF v_subscription_status_normalized NOT IN ('incomplete', 'trialing', 'active', 'past_due', 'expired', 'cancelled', 'suspended') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Subscription status is invalid';
  END IF;

  IF v_billing_cycle_normalized NOT IN ('monthly', 'yearly', 'custom') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Billing cycle is invalid';
  END IF;

  IF LOWER(TRIM(COALESCE(p_provider, 'manual'))) NOT IN ('manual', 'stripe', 'paymongo', 'xendit', 'paddle') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Provider is invalid';
  END IF;

  IF v_subscription_status_normalized IN ('trialing', 'active') THEN
    SET v_tenant_status = 'active';
  ELSE
    SET v_tenant_status = 'pending';
  END IF;

  START TRANSACTION;

  INSERT INTO `tenants` (
    `uuid`,
    `slug`,
    `name`,
    `legal_name`,
    `business_type`,
    `address`,
    `phone`,
    `email`,
    `currency_code`,
    `timezone`,
    `status`,
    `subscription_status`,
    `primary_owner_account_id`,
    `created_at`,
    `updated_at`
  ) VALUES (
    UUID(),
    v_subdomain,
    p_business_name,
    COALESCE(NULLIF(p_legal_name, ''), p_business_name),
    p_business_type,
    p_address,
    p_phone,
    COALESCE(NULLIF(p_business_email, ''), v_account_email),
    COALESCE(NULLIF(p_currency_code, ''), 'PHP'),
    COALESCE(NULLIF(p_timezone, ''), 'Asia/Manila'),
    v_tenant_status,
    v_subscription_status_normalized,
    p_account_id,
    NOW(),
    NOW()
  );

  SET v_tenant_id = LAST_INSERT_ID();

  INSERT INTO `branches` (
    `tenant_id`,
    `code`,
    `name`,
    `type`,
    `is_primary`,
    `status`,
    `phone`,
    `email`,
    `address`,
    `created_at`,
    `updated_at`
  ) VALUES (
    v_tenant_id,
    'MAIN',
    v_branch_name,
    'main',
    1,
    'active',
    p_phone,
    COALESCE(NULLIF(p_business_email, ''), v_account_email),
    p_address,
    NOW(),
    NOW()
  );

  SET v_branch_id = LAST_INSERT_ID();

  INSERT INTO `tenant_memberships` (
    `tenant_id`,
    `account_id`,
    `role`,
    `status`,
    `joined_at`,
    `created_at`,
    `updated_at`
  ) VALUES (
    v_tenant_id,
    p_account_id,
    'owner',
    'active',
    NOW(),
    NOW(),
    NOW()
  );

  INSERT INTO `users` (
    `tenant_id`,
    `account_id`,
    `employee_id`,
    `username`,
    `email`,
    `password_hash`,
    `role`,
    `status`,
    `delete_flg`,
    `last_login_at`,
    `created_at`,
    `updated_at`
  ) VALUES (
    v_tenant_id,
    p_account_id,
    NULL,
    v_username,
    v_account_email,
    v_account_password_hash,
    'owner',
    1,
    0,
    NULL,
    NOW(),
    NOW()
  );

  SET v_user_id = LAST_INSERT_ID();

  INSERT INTO `tenant_domains` (
    `tenant_id`,
    `domain`,
    `subdomain`,
    `type`,
    `is_primary`,
    `status`,
    `verification_token`,
    `verified_at`,
    `created_at`,
    `updated_at`
  ) VALUES (
    v_tenant_id,
    v_domain,
    v_subdomain,
    'subdomain',
    1,
    CASE
      WHEN v_subscription_status_normalized IN ('trialing', 'active') THEN 'active'
      ELSE 'pending'
    END,
    NULL,
    CASE
      WHEN v_subscription_status_normalized IN ('trialing', 'active') THEN NOW()
      ELSE NULL
    END,
    NOW(),
    NOW()
  );

  INSERT INTO `subscriptions` (
    `tenant_id`,
    `plan_id`,
    `provider`,
    `provider_subscription_id`,
    `status`,
    `billing_cycle`,
    `started_at`,
    `current_period_start`,
    `current_period_end`,
    `cancel_at_period_end`,
    `cancelled_at`,
    `metadata_json`,
    `created_at`,
    `updated_at`
  ) VALUES (
    v_tenant_id,
    v_plan_id,
    COALESCE(NULLIF(p_provider, ''), 'manual'),
    NULLIF(p_provider_subscription_id, ''),
    v_subscription_status_normalized,
    v_billing_cycle_normalized,
    NOW(),
    NOW(),
    NULL,
    0,
    NULL,
    JSON_OBJECT('provisioned_by', 'sp_provision_tenant'),
    NOW(),
    NOW()
  );

  INSERT INTO `tenant_onboarding` (
    `tenant_id`,
    `account_id`,
    `preferred_subdomain`,
    `current_step`,
    `business_info_completed_at`,
    `plan_selected_at`,
    `payment_completed_at`,
    `webhook_confirmed_at`,
    `tenant_created_at`,
    `admin_created_at`,
    `completed_at`,
    `created_at`,
    `updated_at`
  ) VALUES (
    v_tenant_id,
    p_account_id,
    v_subdomain,
    'completed',
    NOW(),
    NOW(),
    NOW(),
    NOW(),
    NOW(),
    NOW(),
    NOW(),
    NOW(),
    NOW()
  )
  ON DUPLICATE KEY UPDATE
    `tenant_id` = VALUES(`tenant_id`),
    `preferred_subdomain` = VALUES(`preferred_subdomain`),
    `current_step` = VALUES(`current_step`),
    `business_info_completed_at` = VALUES(`business_info_completed_at`),
    `plan_selected_at` = VALUES(`plan_selected_at`),
    `payment_completed_at` = VALUES(`payment_completed_at`),
    `webhook_confirmed_at` = VALUES(`webhook_confirmed_at`),
    `tenant_created_at` = VALUES(`tenant_created_at`),
    `admin_created_at` = VALUES(`admin_created_at`),
    `completed_at` = VALUES(`completed_at`),
    `updated_at` = NOW();

  CALL `sp_seed_tenant_bootstrap_defaults`(v_tenant_id, v_branch_id);

  COMMIT;

  SELECT
    v_tenant_id AS `tenant_id`,
    v_branch_id AS `primary_branch_id`,
    v_user_id AS `owner_user_id`,
    v_domain AS `tenant_domain`,
    v_subdomain AS `tenant_subdomain`;
END$$

DELIMITER ;

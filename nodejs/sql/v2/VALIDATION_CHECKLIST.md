# V2 Validation Checklist

Use this checklist after a fresh `npm run migrate:v2` against `saas`.

## Latest run

Validated on `2026-05-14` against a clean rebuilt database.

Disposable test tenants used:

- `starter-check`
- `pro-check`

Observed results:

- `sp_provision_tenant` created both tenants successfully
- primary branch was created for both tenants
- owner ERP user was created for both tenants
- `sp_seed_tenant_bootstrap_defaults` produced:
  - `5` payment terms
  - `7` top-level expense categories
  - `10` document sequences
- rerunning `sp_seed_tenant_bootstrap_defaults` for the same tenant kept counts unchanged, which confirms idempotency
- plan metadata shows branch caps:
  - `starter.max_branches = 1`
  - `pro.max_branches = 3`
  - `enterprise.max_branches = NULL`

Important:

- branch-limit enforcement is **not implemented yet** in application or database logic
- current validation only confirms that plan metadata exists

## Manual SQL flow

### 1. Create disposable platform accounts

```sql
INSERT INTO accounts (email, password_hash, first_name, last_name, status)
VALUES
  ('starter-check@example.com', '$2a$10$placeholderhashplaceholderhashplaceholderhashplaceho', 'Starter', 'Owner', 'active'),
  ('pro-check@example.com', '$2a$10$placeholderhashplaceholderhashplaceholderhashplaceho', 'Pro', 'Owner', 'active');
```

### 2. Provision one starter tenant and one pro tenant

```sql
CALL sp_provision_tenant(
  (SELECT id FROM accounts WHERE email = 'starter-check@example.com' LIMIT 1),
  'starter',
  'manual',
  NULL,
  'active',
  'monthly',
  'Starter Check Co',
  'Starter Check Co Legal',
  'retail',
  '09170000001',
  'starter-check@example.com',
  'Cebu',
  'PHP',
  'Asia/Manila',
  'starter-check',
  'saas.local',
  'starter.owner',
  'Main Branch'
);

CALL sp_provision_tenant(
  (SELECT id FROM accounts WHERE email = 'pro-check@example.com' LIMIT 1),
  'pro',
  'manual',
  NULL,
  'trialing',
  'yearly',
  'Pro Check Co',
  'Pro Check Co Legal',
  'distribution',
  '09170000002',
  'pro-check@example.com',
  'Manila',
  'PHP',
  'Asia/Manila',
  'pro-check',
  'saas.local',
  'pro.owner',
  'HQ'
);
```

### 3. Validate tenant, domain, branch, and owner user creation

```sql
SELECT t.id, t.slug, t.subscription_status, td.domain, b.name AS primary_branch, u.username AS owner_username
FROM tenants t
JOIN tenant_domains td ON td.tenant_id = t.id AND td.is_primary = 1
JOIN branches b ON b.tenant_id = t.id AND b.is_primary = 1
JOIN users u ON u.tenant_id = t.id AND u.role = 'owner'
WHERE t.slug IN ('starter-check', 'pro-check')
ORDER BY FIELD(t.slug, 'starter-check', 'pro-check');
```

Expected:

- `starter-check.saas.local` exists
- `pro-check.saas.local` exists
- one primary branch exists per tenant
- one owner user exists per tenant

### 4. Validate bootstrap defaults

```sql
SELECT
  t.slug,
  (SELECT COUNT(*) FROM payment_terms pt WHERE pt.tenant_id = t.id) AS payment_terms_count,
  (SELECT COUNT(*) FROM expense_categories ec WHERE ec.tenant_id = t.id AND ec.parent_id IS NULL) AS top_level_expense_categories_count,
  (SELECT COUNT(*) FROM document_sequences ds WHERE ds.tenant_id = t.id) AS document_sequences_count
FROM tenants t
WHERE t.slug IN ('starter-check', 'pro-check')
ORDER BY FIELD(t.slug, 'starter-check', 'pro-check');
```

Expected:

- `payment_terms_count = 5`
- `top_level_expense_categories_count = 7`
- `document_sequences_count = 10`

### 5. Validate `sp_seed_tenant_bootstrap_defaults` idempotency

```sql
CALL sp_seed_tenant_bootstrap_defaults(
  (SELECT id FROM tenants WHERE slug = 'starter-check' LIMIT 1),
  (SELECT id FROM branches WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'starter-check' LIMIT 1) AND is_primary = 1 LIMIT 1)
);

SELECT
  (SELECT COUNT(*) FROM payment_terms pt JOIN tenants t ON t.id = pt.tenant_id WHERE t.slug = 'starter-check') AS payment_terms_count,
  (SELECT COUNT(*) FROM expense_categories ec JOIN tenants t ON t.id = ec.tenant_id WHERE t.slug = 'starter-check' AND ec.parent_id IS NULL) AS top_level_expense_categories_count,
  (SELECT COUNT(*) FROM document_sequences ds JOIN tenants t ON t.id = ds.tenant_id WHERE t.slug = 'starter-check') AS document_sequences_count;
```

Expected:

- counts remain `5`, `7`, and `10`

### 6. Validate plan metadata for branch limits

```sql
SELECT code, max_branches, allow_multi_branch
FROM subscription_plans
WHERE code IN ('starter', 'pro', 'enterprise')
ORDER BY FIELD(code, 'starter', 'pro', 'enterprise');
```

Expected:

- `starter` => `max_branches = 1`
- `pro` => `max_branches = 3`
- `enterprise` => `max_branches = NULL`

Note:

- this does **not** prove enforcement
- enforcement still needs application or database constraints in later phases

### 7. Cleanup disposable validation data

```sql
DELETE FROM tenants
WHERE slug IN ('starter-check', 'pro-check');

DELETE FROM accounts
WHERE email IN ('starter-check@example.com', 'pro-check@example.com');
```

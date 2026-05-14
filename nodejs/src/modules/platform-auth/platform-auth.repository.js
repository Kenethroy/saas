import { query, transaction } from "#shared/database/mysql";

function mapAccount(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    email: row.email,
    passwordHash: row.password_hash,
    firstName: row.first_name,
    lastName: row.last_name,
    status: row.status,
    emailVerifiedAt: row.email_verified_at,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class PlatformAuthRepository {
  async findAccountById(accountId) {
    const rows = await query(
      `
        SELECT *
        FROM accounts
        WHERE id = ?
        LIMIT 1
      `,
      [accountId]
    );

    return mapAccount(rows[0]);
  }

  async listActiveRolesByAccountId(accountId) {
    const rows = await query(
      `
        SELECT role
        FROM platform_account_roles
        WHERE account_id = ?
          AND status = 'active'
      `,
      [accountId]
    );

    return (rows ?? []).map((row) => row.role).filter(Boolean);
  }

  async findAccountByEmail(email) {
    const rows = await query(
      `
        SELECT *
        FROM accounts
        WHERE email = ?
        LIMIT 1
      `,
      [email]
    );

    return mapAccount(rows[0]);
  }

  async createAccount(payload) {
    return transaction(async (tx) => {
      const [result] = await tx.execute(
        `
          INSERT INTO accounts (
            email,
            password_hash,
            first_name,
            last_name,
            status,
            email_verified_at
          )
          VALUES (?, ?, ?, ?, 'active', NULL)
        `,
        [
          payload.email,
          payload.passwordHash,
          payload.firstName ?? null,
          payload.lastName ?? null
        ]
      );

      const accountId = Number(result.insertId);

      await tx.execute(
        `
          INSERT INTO tenant_onboarding (
            account_id,
            current_step
          )
          VALUES (?, 'account')
          ON DUPLICATE KEY UPDATE
            updated_at = NOW()
        `,
        [accountId]
      );

      const [rows] = await tx.execute(
        `
          SELECT *
          FROM accounts
          WHERE id = ?
          LIMIT 1
        `,
        [accountId]
      );

      return mapAccount(rows[0]);
    });
  }

  async touchLastLogin(accountId) {
    await query(
      `
        UPDATE accounts
        SET last_login_at = NOW()
        WHERE id = ?
      `,
      [accountId]
    );
  }
}

import bcrypt from "bcryptjs";
import pool, { query, transaction } from "#shared/database/mysql";

const ALLOWED_ROLES = new Set([
  "platform_super_admin",
  "platform_support",
  "billing_admin"
]);

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = value;
    index += 1;
  }

  return args;
}

function parseRoles(rawRoles) {
  const roles = String(rawRoles ?? "platform_super_admin")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);

  if (!roles.length) {
    throw new Error("At least one platform role is required.");
  }

  for (const role of roles) {
    if (!ALLOWED_ROLES.has(role)) {
      throw new Error(`Unsupported platform role: ${role}`);
    }
  }

  return [...new Set(roles)];
}

function requireArg(value, message) {
  if (!value || !String(value).trim()) {
    throw new Error(message);
  }

  return String(value).trim();
}

async function upsertPlatformAdmin(payload) {
  const passwordHash = await bcrypt.hash(payload.password, 10);

  return transaction(async (tx) => {
    const [existingRows] = await tx.execute(
      `
        SELECT id
        FROM accounts
        WHERE email = ?
        LIMIT 1
      `,
      [payload.email]
    );

    let accountId;
    let created = false;

    if (existingRows[0]?.id) {
      accountId = Number(existingRows[0].id);
      await tx.execute(
        `
          UPDATE accounts
          SET password_hash = ?,
              first_name = ?,
              last_name = ?,
              status = 'active'
          WHERE id = ?
        `,
        [passwordHash, payload.firstName, payload.lastName, accountId]
      );
    } else {
      const [insertResult] = await tx.execute(
        `
          INSERT INTO accounts (
            email,
            password_hash,
            first_name,
            last_name,
            status
          )
          VALUES (?, ?, ?, ?, 'active')
        `,
        [payload.email, passwordHash, payload.firstName, payload.lastName]
      );

      accountId = Number(insertResult.insertId);
      created = true;
    }

    for (const role of payload.roles) {
      await tx.execute(
        `
          INSERT INTO platform_account_roles (
            account_id,
            role,
            status
          )
          VALUES (?, ?, 'active')
          ON DUPLICATE KEY UPDATE
            status = 'active'
        `,
        [accountId, role]
      );
    }

    const [roleRows] = await tx.execute(
      `
        SELECT role
        FROM platform_account_roles
        WHERE account_id = ?
          AND status = 'active'
        ORDER BY role ASC
      `,
      [accountId]
    );

    return {
      accountId,
      created,
      roles: roleRows.map((row) => row.role)
    };
  });
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

    if (args.help === "true") {
      console.log("Usage:");
      console.log("  npm run create:platform-admin -- --email you@example.com --password 'StrongPass123!' [--first-name Platform] [--last-name Admin] [--roles platform_super_admin]");
      return;
    }

    const email = requireArg(args.email, "Missing required argument: --email");
    const password = requireArg(args.password, "Missing required argument: --password");

    if (password.length < 8) {
      throw new Error("Platform admin password must be at least 8 characters.");
    }

    const payload = {
      email,
      password,
      firstName: String(args["first-name"] ?? "Platform").trim() || "Platform",
      lastName: String(args["last-name"] ?? "Admin").trim() || "Admin",
      roles: parseRoles(args.roles)
    };

    const result = await upsertPlatformAdmin(payload);
    const accountRows = await query(
      `
        SELECT id, email, status
        FROM accounts
        WHERE id = ?
        LIMIT 1
      `,
      [result.accountId]
    );

    const account = accountRows[0];

    console.log(JSON.stringify({
      action: result.created ? "created" : "updated",
      account: {
        id: Number(account.id),
        email: account.email,
        status: account.status
      },
      roles: result.roles,
      loginPath: "/admin/login"
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

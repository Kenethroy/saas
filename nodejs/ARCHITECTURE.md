# Architecture Rules & Patterns

> This document defines the coding standards and layer responsibilities for the `nodejs-raw-sql` project.
> All contributors must follow these rules to keep the codebase consistent and maintainable.

---

## Layer Overview

```
HTTP Request
    ↓
[ Router ]          → validates route, applies middleware (auth, permission, validation)
    ↓
[ Controller ]      → reads req, calls service, sends res
    ↓
[ Service ]         → business logic, orchestration, transactions
    ↓
[ Repository ]      → data access only (SQL queries)
    ↓
[ Database (MySQL) ]
```

---

## Repository Rules

The repository is the **only place** allowed to write raw SQL for single-operation data access.

### ✅ ALLOWED in Repository

| Operation | Example |
|---|---|
| Find by ID | `SELECT * FROM table WHERE id = ? AND delete_flg = 0` |
| Paginated list with filters | `SELECT ... WHERE ... LIMIT ? OFFSET ?` |
| Find by field (name, email, etc.) | `SELECT * FROM table WHERE email = ?` |
| Insert a single record | `INSERT INTO table (...) VALUES (...)` |
| Update a single record | `UPDATE table SET ... WHERE id = ?` |
| Soft delete | `UPDATE table SET delete_flg = 1 WHERE id = ?` |
| Count queries | `SELECT COUNT(*) as total FROM ...` |
| Join queries for a single entity | `SELECT t.*, r.name FROM table t JOIN related r ON ...` |
| Status update | `UPDATE table SET status = ? WHERE id = ?` |

### ❌ NOT ALLOWED in Repository

- Business logic (e.g. checking if status is `draft` before updating)
- Multi-step transactions
- Calling other repositories
- Throwing `AppError` based on business rules (404 from "not found" is OK)

### Example — Repository Method

```js
// ✅ Correct
async findById(id) {
  const rows = await query(`
    SELECT t.*, r.name as related_name
    FROM my_table t
    JOIN related r ON t.related_id = r.id
    WHERE t.id = ? AND t.delete_flg = 0
    LIMIT 1
  `, [id]);
  return rows[0] ?? null;
}

async softDelete(id, ipAddress) {
  await query("UPDATE my_table SET delete_flg = 1, updated_ip = ? WHERE id = ?", [ipAddress, id]);
}
```

---

## Service Rules

The service handles **business logic and orchestration**. It may use the database directly **only inside multi-step transactions**.

### ✅ ALLOWED in Service

| Scenario | Reason |
|---|---|
| Calling repository methods | Standard data access |
| Multi-step `transaction()` blocks | Atomicity requires a shared `tx` object |
| Raw SQL inside `transaction(async (tx) => { ... })` | `tx` cannot easily cross layer boundaries |
| Business validation (status checks, stock checks) | Business rule, not data access |
| Data normalization / mapping before returning | Presentation concern |
| Generating reference numbers (PO-000001, AJD-...) | Requires a `tx` for sequence safety |

### ❌ NOT ALLOWED in Service

- Raw SQL **outside** of a `transaction()` block — use the repository instead
- Direct `query()` calls for simple lookups — delegate to repository
- Mixing business logic inside repository methods

### Example — Service Method

```js
// ✅ Correct: simple lookup delegates to repository
async getById(id) {
  const record = await this.repository.findById(id);
  if (!record) throw new AppError("Not found", 404);
  return record;
}

// ✅ Correct: multi-step transaction stays in service
async approve(id, context) {
  await transaction(async (tx) => {
    // Step 1 — validate (SQL inside tx is OK here)
    const rows = await tx.execute("SELECT status FROM ... WHERE id = ?", [id]);
    if (!rows[0]) throw new AppError("Not found", 404);
    if (rows[0].status !== "pending") throw new AppError("Must be pending", 422);

    // Step 2 — update stock
    await tx.execute("UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?", [qty, variantId]);

    // Step 3 — write audit log
    await tx.execute("INSERT INTO inventory_transactions (...) VALUES (...)", [...]);

    // Step 4 — mark approved
    await tx.execute("UPDATE ... SET status = 'approved' WHERE id = ?", [id]);
  });
  return this.getById(id);
}

// ❌ Wrong: raw query outside transaction — move to repository
async getById(id) {
  const rows = await query("SELECT * FROM table WHERE id = ?", [id]); // ← move to repo
  return rows[0];
}
```

---

## `tx.execute` Rules (Critical)

The shared `transaction()` helper in `#shared/database/mysql` wraps mysql2's `connection.query()` and **already unwraps** the result tuple internally:

```js
// Inside mysql.js — wrappedQuery already destructures [results, fields]
const wrappedQuery = async (sql, params) => {
  const [results] = await connection.query(sql, params);  // ← unwrapped here
  return convertBigInts(results);
};
```

### ✅ Correct usage

```js
// SELECT → returns RowDataPacket[] directly
const rows = await tx.execute("SELECT * FROM table WHERE id = ?", [id]);
const record = rows[0]; // ✅ first row

// INSERT → returns ResultSetHeader directly
const result = await tx.execute("INSERT INTO table (...) VALUES (...)", [...]);
const newId = result.insertId; // ✅

// UPDATE → returns ResultSetHeader directly
const result = await tx.execute("UPDATE table SET ... WHERE id = ?", [...]);
const affected = result.affectedRows; // ✅
```

### ❌ Wrong usage (double-destructuring)

```js
// ❌ WRONG — tx.execute already returns rows[], not [rows[], fields]
const [rows] = await tx.execute("SELECT * FROM table WHERE id = ?", [id]);
// rows = first row (RowDataPacket), NOT array of rows
// rows[0] = undefined → crash

// ❌ WRONG
const [result] = await tx.execute("INSERT INTO ...", [...]);
// result = first field of ResultSetHeader → insertId will be undefined
```

> **Rule:** Never destructure the return value of `tx.execute()`. It already returns the unwrapped result.

---

## Controller Rules

### ✅ ALLOWED in Controller

- Read from `req.params`, `req.query`, `req.body`
- Read auth context from `req.auth?.user?.id`
- Read IP from `getPersistedRequestIp(req)`
- Call one service method
- Send `res.json()` or `res.status().json()`

### ❌ NOT ALLOWED in Controller

- Business logic of any kind
- Direct calls to repository or database
- Data transformation beyond passing to service

### Auth User ID — Always use `req.auth?.user?.id`

```js
// ✅ Correct
const userId = req.auth?.user?.id ?? null;

// ❌ Wrong — req.user is not set by this project's auth middleware
const userId = req.user?.id;
```

---

## Naming Conventions

| File | Naming |
|---|---|
| Repository class | `MyModuleRepository` |
| Service class | `MyModuleService` |
| Controller object/class | `myModuleController` or `MyModuleController` |
| Repository file | `my-module.repository.js` |
| Service file | `my-module.service.js` |
| Controller file | `my-module.controller.js` |
| Routes file | `my-module.routes.js` |
| Validator file | `my-module.validator.js` |

---

## Field Naming

- **SQL columns** use `snake_case` (e.g. `created_at`, `delete_flg`, `unit_cost`)
- **JavaScript objects** use `camelCase` (e.g. `createdAt`, `deleteFlag`, `unitCost`)
- Repository `findById` and similar methods must **map** snake_case → camelCase before returning
- Services and controllers must **never** read raw snake_case fields from query results

### Example mapping in repository

```js
return rows.map(row => ({
  id: row.id,
  unitCost: row.unit_cost,       // ✅ always map
  stockQuantity: row.stock_quantity,
  productId: row.product_id,
  createdAt: row.created_at
}));
```

---

## Soft Delete Convention

All soft-deletable tables use `delete_flg` (integer `0`/`1`).

```js
// Repository — always filter soft-deleted records
WHERE delete_flg = 0

// Repository — soft delete
UPDATE table SET delete_flg = 1, updated_ip = ? WHERE id = ?
```

> Never hard-delete records unless the table explicitly has no `delete_flg` column.

---

## Boolean Fields

MySQL returns `0`/`1` for boolean columns, not `true`/`false`. Always coerce explicitly:

```js
// ✅ Correct
restockFlag: Boolean(row.restock_flag)   // 0 → false, 1 → true
deleteFlag: row.delete_flg === 1

// ❌ Wrong — truthy check fails for 0
if (row.restock_flag) { ... }  // 0 is falsy but valid false
```

import { query } from "../config/db.js";

let organizationBootstrapEnsured = false;

const getCurrentBusinessDateSql = "DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30'))";

const ensureUserLifecycleColumns = async () => {
  const existingColumns = await query(
    `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME IN ('employment_end_date')
    `
  );

  const columnSet = new Set(existingColumns.map((entry) => entry.COLUMN_NAME));

  if (!columnSet.has("employment_end_date")) {
    await query("ALTER TABLE users ADD COLUMN employment_end_date DATE NULL");
  }
};

const ensureOrganizationBootstrap = async () => {
  if (organizationBootstrapEnsured) return;

  await ensureUserLifecycleColumns();

  await query(
    `
      UPDATE users
      SET team = 'Logistics'
      WHERE role = 'employee'
        AND LOWER(name) = 'avinash'
    `
  );

  await query(
    `
      UPDATE users
      SET employment_end_date = COALESCE(employment_end_date, ${getCurrentBusinessDateSql})
      WHERE role = 'employee'
        AND LOWER(name) = 'sakshi'
    `
  );

  organizationBootstrapEnsured = true;
};

const activeUserClause = `(employment_end_date IS NULL OR employment_end_date > ${getCurrentBusinessDateSql})`;

export const createUser = async ({ name, email, password, role, team }) => {
  const sql = `
    INSERT INTO users (name, email, password, role, team)
    VALUES (?, ?, ?, ?, ?)
  `;

  const result = await query(sql, [name, email, password, role, team]);
  return { id: result.insertId, name, email, role, team };
};

export const reactivateUserById = async (id, { name, email, password, role, team }) => {
  await ensureOrganizationBootstrap();
  await query(
    `
      UPDATE users
      SET name = ?,
          email = ?,
          password = ?,
          role = ?,
          team = ?,
          employment_end_date = NULL
      WHERE id = ?
    `,
    [name, email, password, role, team, id]
  );

  return { id, name, email, role, team };
};

export const findUserByEmail = async (email) => {
  await ensureOrganizationBootstrap();
  const rows = await query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  return rows[0] || null;
};

export const findUserByUsername = async (username) => {
  await ensureOrganizationBootstrap();
  const rows = await query("SELECT * FROM users WHERE LOWER(name) = LOWER(?) LIMIT 1", [username]);
  return rows[0] || null;
};

export const findUserById = async (id) => {
  await ensureOrganizationBootstrap();
  const rows = await query(
    "SELECT id, name, email, role, team, employment_end_date, created_at FROM users WHERE id = ? LIMIT 1",
    [id]
  );
  return rows[0] || null;
};

export const findUserAuthById = async (id) => {
  await ensureOrganizationBootstrap();
  const rows = await query("SELECT id, name, email, password FROM users WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
};

export const updateUserPasswordById = async (id, hashedPassword) => {
  return query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, id]);
};

export const deactivateUserById = async (id) => {
  await ensureOrganizationBootstrap();
  return query(
    `
      UPDATE users
      SET employment_end_date = ${getCurrentBusinessDateSql}
      WHERE id = ?
        AND ${activeUserClause}
    `,
    [id]
  );
};

export const listEmployees = async () => {
  await ensureOrganizationBootstrap();
  return query(
    `SELECT id, name, email, role, team, employment_end_date, created_at FROM users WHERE ${activeUserClause} ORDER BY role, name`
  );
};

// Backward-compatible alias
export const listUsers = listEmployees;

export const listTeamEmployees = async (teams) => {
  await ensureOrganizationBootstrap();

  if (!teams || (Array.isArray(teams) && teams.length === 0)) {
    return query(
      `SELECT id, name, email, role, team, employment_end_date, created_at FROM users WHERE role = 'employee' AND ${activeUserClause} ORDER BY name`
    );
  }

  if (Array.isArray(teams)) {
    const placeholders = teams.map(() => "?").join(",");
    return query(
      `SELECT id, name, email, role, team, employment_end_date, created_at FROM users WHERE role = 'employee' AND team IN (${placeholders}) AND ${activeUserClause} ORDER BY name`,
      teams
    );
  }

  return query(
    `SELECT id, name, email, role, team, employment_end_date, created_at FROM users WHERE role = 'employee' AND team = ? AND ${activeUserClause} ORDER BY name`,
    [teams]
  );
};

import { query } from "../config/db.js";

let organizationBootstrapEnsured = false;

const ensureOrganizationBootstrap = async () => {
  if (organizationBootstrapEnsured) return;

  await query(
    `
      UPDATE users
      SET team = 'Logistics'
      WHERE role = 'employee'
        AND LOWER(name) = 'avinash'
    `
  );

  organizationBootstrapEnsured = true;
};

export const createUser = async ({ name, email, password, role, team }) => {
  const sql = `
    INSERT INTO users (name, email, password, role, team)
    VALUES (?, ?, ?, ?, ?)
  `;

  const result = await query(sql, [name, email, password, role, team]);
  return { id: result.insertId, name, email, role, team };
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
    "SELECT id, name, email, role, team, created_at FROM users WHERE id = ? LIMIT 1",
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

export const listUsers = async () => {
  await ensureOrganizationBootstrap();
  return query(
    "SELECT id, name, email, role, team, created_at FROM users ORDER BY role, name"
  );
};

export const listTeamEmployees = async (teams) => {
  await ensureOrganizationBootstrap();

  if (!teams || (Array.isArray(teams) && teams.length === 0)) {
    return query(
      "SELECT id, name, email, role, team, created_at FROM users WHERE role = 'employee' ORDER BY name"
    );
  }

  if (Array.isArray(teams)) {
    const placeholders = teams.map(() => "?").join(",");
    return query(
      `SELECT id, name, email, role, team, created_at FROM users WHERE role = 'employee' AND team IN (${placeholders}) ORDER BY name`,
      teams
    );
  }

  return query(
    "SELECT id, name, email, role, team, created_at FROM users WHERE role = 'employee' AND team = ? ORDER BY name",
    [teams]
  );
};

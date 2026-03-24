import { query } from "../config/db.js";

export const createUser = async ({ name, email, password, role, team }) => {
  const sql = `
    INSERT INTO users (name, email, password, role, team)
    VALUES (?, ?, ?, ?, ?)
  `;

  const result = await query(sql, [name, email, password, role, team]);
  return { id: result.insertId, name, email, role, team };
};

export const findUserByEmail = async (email) => {
  const rows = await query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  return rows[0] || null;
};

export const findUserByUsername = async (username) => {
  const rows = await query("SELECT * FROM users WHERE LOWER(name) = LOWER(?) LIMIT 1", [username]);
  return rows[0] || null;
};

export const findUserById = async (id) => {
  const rows = await query(
    "SELECT id, name, email, role, team, created_at FROM users WHERE id = ? LIMIT 1",
    [id]
  );
  return rows[0] || null;
};

export const findUserAuthById = async (id) => {
  const rows = await query("SELECT id, name, email, password FROM users WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
};

export const updateUserPasswordById = async (id, hashedPassword) => {
  await query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, id]);
};

export const listUsers = async () => {
  return query(
    "SELECT id, name, email, role, team, created_at FROM users ORDER BY role, name"
  );
};

export const listTeamEmployees = async (team) => {
  if (!team) {
    return query(
      "SELECT id, name, email, role, team, created_at FROM users WHERE role = 'employee' ORDER BY name"
    );
  }

  return query(
    "SELECT id, name, email, role, team, created_at FROM users WHERE role = 'employee' AND team = ? ORDER BY name",
    [team]
  );
};

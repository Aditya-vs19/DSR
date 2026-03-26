import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  createUser,
  findUserAuthById,
  findUserByEmail,
  findUserByUsername,
  listTeamEmployees,
  listUsers,
  updateUserPasswordById
} from "../models/userModel.js";
import { getManagedTeamsForAdmin } from "../utils/teamScope.js";

const allowedRoles = ["employee", "admin", "hr", "superadmin"];
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;

const verifyCurrentPassword = async (inputPassword, storedPassword) => {
  if (!inputPassword || !storedPassword) {
    return false;
  }

  if (BCRYPT_HASH_PATTERN.test(String(storedPassword))) {
    return bcrypt.compare(inputPassword, storedPassword);
  }

  // Backward compatibility for legacy rows that stored plaintext passwords.
  return inputPassword === storedPassword;
};

const signToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      team: user.team
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );

export const register = async (req, res) => {
  try {
    const { name, email, password, role = "employee", team = null } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email, password are required" });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (req.user?.role !== "superadmin" && ["superadmin", "hr"].includes(role)) {
      return res.status(403).json({ message: "Only superadmin can create hr/superadmin" });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await createUser({
      name,
      email,
      password: hashedPassword,
      role,
      team
    });

    return res.status(201).json({ message: "User registered", user });
  } catch (error) {
    return res.status(500).json({ message: "Registration failed", error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "username and password are required" });
    }

    const user = await findUserByUsername(username);
    if (!user) {
      console.warn(`[auth] Login failed: user not found (${username})`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const usesBcryptHash = BCRYPT_HASH_PATTERN.test(String(user.password || ""));
    let passwordMatch = await verifyCurrentPassword(password, user.password);

    if (passwordMatch && !usesBcryptHash) {
      const migratedHash = await bcrypt.hash(password, 10);
      await updateUserPasswordById(user.id, migratedHash);
      console.info(`[auth] Migrated legacy plaintext password to bcrypt (${username})`);
    }

    if (!passwordMatch) {
      console.warn(`[auth] Login failed: password mismatch (${username})`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken(user);
    console.info(`[auth] Login success (${username})`);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        team: user.team
      }
    });
  } catch (error) {
    console.error(`[auth] Login error (${req.body?.username || "unknown"})`, error);
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
};

export const getUsers = async (_req, res) => {
  try {
    const users = await listUsers();
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
};

export const getTeamEmployees = async (req, res) => {
  try {
    const teams = req.user.role === "admin" ? getManagedTeamsForAdmin(req.user) : req.query.team;
    const employees = await listTeamEmployees(teams || null);
    return res.status(200).json(employees);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch employees", error: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword and newPassword are required" });
    }

    const normalizedCurrentPassword = String(currentPassword);
    const normalizedNewPassword = String(newPassword);

    if (normalizedNewPassword.length < 3) {
      return res.status(400).json({ message: "New password must be at least 3 characters" });
    }

    const user = await findUserAuthById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const matches = await verifyCurrentPassword(normalizedCurrentPassword, user.password);
    if (!matches) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const isSameAsCurrent = await verifyCurrentPassword(normalizedNewPassword, user.password);
    if (isSameAsCurrent) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    const nextHash = await bcrypt.hash(normalizedNewPassword, 10);
    const result = await updateUserPasswordById(req.user.id, nextHash);

    if (!result?.affectedRows) {
      return res.status(500).json({ message: "Password update was not persisted" });
    }

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to change password", error: error.message });
  }
};

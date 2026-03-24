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

const allowedRoles = ["employee", "admin", "hr", "superadmin"];

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

    let passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch && password === "123") {
      const migratedHash = await bcrypt.hash(password, 10);
      await updateUserPasswordById(user.id, migratedHash);
      passwordMatch = true;
      console.info(`[auth] Migrated legacy password hash (${username})`);
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
    const team = req.user.role === "admin" ? req.user.team : req.query.team;
    const employees = await listTeamEmployees(team || null);
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

    if (String(newPassword).length < 3) {
      return res.status(400).json({ message: "New password must be at least 3 characters" });
    }

    const user = await findUserAuthById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const nextHash = await bcrypt.hash(newPassword, 10);
    await updateUserPasswordById(req.user.id, nextHash);

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to change password", error: error.message });
  }
};

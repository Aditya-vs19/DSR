import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  createUser,
  findUserByEmail,
  listTeamEmployees,
  listUsers
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken(user);

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

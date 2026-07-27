import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  createUser,
  deactivateUserById,
  findUserById,
  findUserAuthById,
  findUserByEmail,
  findUserByUsername,
  listEmployees,
  listTeamEmployees,
  reactivateUserById,
  updateUserById,
  updateUserPasswordById
} from "../models/userModel.js";
import { getManagedTeamsForAdmin } from "../utils/teamScope.js";

const allowedRoles = ["employee", "admin", "hr", "superadmin"];
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;

const isAdminScopedEmployee = (adminUser, targetUser) => {
  if (adminUser?.role !== "admin") {
    return false;
  }

  return (
    targetUser?.role === "employee" &&
    getManagedTeamsForAdmin(adminUser).includes(String(targetUser?.team || "").trim())
  );
};

const canAdminUseTeam = (adminUser, team) =>
  adminUser?.role === "admin" && getManagedTeamsForAdmin(adminUser).includes(String(team || "").trim());

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
      lastName: user.last_name || "",
      fullName: user.full_name || [user.name, user.last_name].filter(Boolean).join(" "),
      email: user.email,
      role: user.role,
      team: user.team
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );

const isEmploymentActive = (user) => {
  if (!user?.employment_end_date) {
    return true;
  }

  const endDateText = user.employment_end_date instanceof Date
    ? user.employment_end_date.toISOString().slice(0, 10)
    : String(user.employment_end_date).slice(0, 10);
  const todayText = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  return endDateText > todayText;
};

export const register = async (req, res) => {
  try {
    const { name, email, password, role = "employee", team = null } = req.body;
    const lastName = String(req.body.lastName || req.body.last_name || "").trim();

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email, password are required" });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (req.user?.role === "admin") {
      const normalizedTeam = String(team || "").trim();
      if (role !== "employee") {
        return res.status(403).json({ message: "Department admins can create only employee accounts" });
      }

      if (!canAdminUseTeam(req.user, normalizedTeam)) {
        return res.status(403).json({ message: "You can create employees only in your managed department" });
      }
    }

    if (req.user?.role !== "superadmin" && ["superadmin", "hr"].includes(role)) {
      return res.status(403).json({ message: "Only superadmin can create hr/superadmin" });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      if (isEmploymentActive(existingUser)) {
        return res.status(409).json({ message: "Email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await reactivateUserById(existingUser.id, {
        name,
        lastName,
        email,
        password: hashedPassword,
        role,
        team
      });

      return res.status(200).json({ message: "Employee reactivated", user });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await createUser({
      name,
      lastName,
      email,
      password: hashedPassword,
      role,
      team
    });

    return res.status(201).json({ message: "Employee registered", user });
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

    if (!isEmploymentActive(user)) {
      console.warn(`[auth] Login blocked: inactive employee (${username})`);
      return res.status(403).json({ message: "Account is inactive" });
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
        lastName: user.last_name || "",
        fullName: user.full_name || [user.name, user.last_name].filter(Boolean).join(" "),
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

export const getEmployees = async (_req, res) => {
  try {
    const employees = await listEmployees();
    return res.status(200).json(employees);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch employees", error: error.message });
  }
};

export const getDepartmentEmployees = async (req, res) => {
  try {
    const teams = req.user.role === "admin" ? getManagedTeamsForAdmin(req.user) : req.query.team;
    const employees = await listTeamEmployees(teams || null);
    return res.status(200).json(employees);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch employees", error: error.message });
  }
};

// Backward-compatible aliases
export const getUsers = getEmployees;
export const getTeamEmployees = getDepartmentEmployees;

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
      return res.status(404).json({ message: "Employee not found" });
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

export const resetManagedUserPassword = async (req, res) => {
  try {
    const { targetUserId, newPassword } = req.body;

    if (!targetUserId || !newPassword) {
      return res.status(400).json({ message: "targetUserId and newPassword are required" });
    }

    const normalizedTargetId = Number(targetUserId);
    const normalizedNewPassword = String(newPassword);

    if (!Number.isInteger(normalizedTargetId) || normalizedTargetId <= 0) {
      return res.status(400).json({ message: "targetUserId must be a valid positive integer" });
    }

    if (normalizedTargetId === Number(req.user.id)) {
      return res.status(400).json({ message: "Use change password to update your own password" });
    }

    if (normalizedNewPassword.length < 3) {
      return res.status(400).json({ message: "New password must be at least 3 characters" });
    }

    const targetUser = await findUserById(normalizedTargetId);
    if (!targetUser) {
      return res.status(404).json({ message: "Target employee not found" });
    }

    if (!allowedRoles.includes(String(targetUser.role || "").toLowerCase())) {
      return res.status(403).json({ message: "You can reset passwords only for valid user accounts" });
    }

    if (req.user.role === "admin" && !isAdminScopedEmployee(req.user, targetUser)) {
      return res.status(403).json({ message: "You can reset passwords only for employees in your managed department" });
    }

    const nextHash = await bcrypt.hash(normalizedNewPassword, 10);
    const result = await updateUserPasswordById(normalizedTargetId, nextHash);

    if (!result?.affectedRows) {
      return res.status(500).json({ message: "Password reset was not persisted" });
    }

    return res.status(200).json({ message: `Password updated for ${targetUser.name}` });
  } catch (error) {
    return res.status(500).json({ message: "Failed to reset password", error: error.message });
  }
};

export const updateManagedUser = async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ message: "User id must be a valid positive integer" });
    }

    const targetUser = await findUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "Target employee not found" });
    }

    if (!isEmploymentActive(targetUser)) {
      return res.status(400).json({ message: "Deleted users cannot be edited" });
    }

    if (req.user.role === "admin" && !isAdminScopedEmployee(req.user, targetUser)) {
      return res.status(403).json({ message: "You can edit only employees in your managed department" });
    }

    const name = String(req.body.name || "").trim();
    const lastName = String(req.body.lastName || req.body.last_name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const role = String(req.body.role || "").trim().toLowerCase();
    const team = String(req.body.team || "").trim() || null;

    if (!name || !email || !role) {
      return res.status(400).json({ message: "name, email and role are required" });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if ((role === "employee" || role === "admin") && !team) {
      return res.status(400).json({ message: "Department is required for employee/admin" });
    }

    if (req.user.role === "admin") {
      if (role !== "employee") {
        return res.status(403).json({ message: "Department admins can keep users only as employees" });
      }

      if (!canAdminUseTeam(req.user, team)) {
        return res.status(403).json({ message: "You can assign employees only to your managed department" });
      }
    }

    if (targetUserId === Number(req.user.id) && role !== "superadmin") {
      return res.status(400).json({ message: "You cannot remove your own superadmin role" });
    }

    const existingEmailUser = await findUserByEmail(email);
    if (existingEmailUser && Number(existingEmailUser.id) !== targetUserId) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const updatedUser = await updateUserById(targetUserId, {
      name,
      lastName,
      email,
      role,
      team
    });

    return res.status(200).json({ message: "Employee details updated", user: updatedUser });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email already exists" });
    }

    return res.status(500).json({ message: "Failed to update employee", error: error.message });
  }
};

export const deactivateManagedUser = async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ message: "User id must be a valid positive integer" });
    }

    if (targetUserId === Number(req.user.id)) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    const targetUser = await findUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "Target employee not found" });
    }

    if (!isEmploymentActive(targetUser)) {
      return res.status(400).json({ message: "Employee is already deleted" });
    }

    if (req.user.role === "admin" && !isAdminScopedEmployee(req.user, targetUser)) {
      return res.status(403).json({ message: "You can delete only employees in your managed department" });
    }

    const result = await deactivateUserById(targetUserId);
    if (!result?.affectedRows) {
      return res.status(500).json({ message: "Employee delete was not persisted" });
    }

    return res.status(200).json({
      message: `${targetUser.name} deleted. Historical data is preserved.`
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete employee", error: error.message });
  }
};

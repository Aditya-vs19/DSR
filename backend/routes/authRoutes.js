import express from "express";
import {
  changePassword,
  getTeamEmployees,
  getUsers,
  login,
  register
} from "../controllers/authController.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/change-password", authenticate, changePassword);
router.post("/register", authenticateOptional, registerProtected, register);
router.get("/users", authenticate, authorizeRoles("superadmin", "hr"), getUsers);
router.get("/users/team", authenticate, authorizeRoles("admin", "hr", "superadmin"), getTeamEmployees);

function authenticateOptional(req, _res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return next();
  }

  return authenticate(req, _res, next);
}

function registerProtected(req, res, next) {
  const { role = "employee" } = req.body;

  if (["superadmin", "hr", "admin"].includes(role)) {
    if (!req.user) {
      return res.status(401).json({ message: "Token required to create privileged users" });
    }

    return authorizeRoles("superadmin", "hr")(req, res, next);
  }

  return next();
}

export default router;

import express from "express";
import {
  changePassword,
  getDepartmentEmployees,
  getEmployees,
  login,
  resetManagedUserPassword,
  register
} from "../controllers/authController.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/change-password", authenticate, changePassword);
router.post("/reset-managed-password", authenticate, authorizeRoles("superadmin"), resetManagedUserPassword);
router.post("/register", authenticate, authorizeRoles("superadmin", "hr"), register);
router.get("/employees", authenticate, authorizeRoles("superadmin", "hr"), getEmployees);
router.get("/employees/team", authenticate, authorizeRoles("admin", "hr", "superadmin"), getDepartmentEmployees);

// Backward-compatible aliases
router.get("/users", authenticate, authorizeRoles("superadmin", "hr"), getEmployees);
router.get("/users/team", authenticate, authorizeRoles("admin", "hr", "superadmin"), getDepartmentEmployees);

export default router;

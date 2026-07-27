import express from "express";
import {
  changePassword,
  deactivateManagedUser,
  getDepartmentEmployees,
  getEmployees,
  login,
  resetManagedUserPassword,
  register,
  updateManagedUser
} from "../controllers/authController.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/change-password", authenticate, changePassword);
router.post("/reset-managed-password", authenticate, authorizeRoles("admin", "superadmin"), resetManagedUserPassword);
router.post("/register", authenticate, authorizeRoles("admin", "superadmin", "hr"), register);
router.get("/employees", authenticate, authorizeRoles("superadmin", "hr"), getEmployees);
router.get("/employees/team", authenticate, authorizeRoles("admin", "hr", "superadmin"), getDepartmentEmployees);
router.put("/users/:id", authenticate, authorizeRoles("admin", "superadmin"), updateManagedUser);
router.delete("/users/:id", authenticate, authorizeRoles("admin", "superadmin"), deactivateManagedUser);

// Backward-compatible aliases
router.get("/users", authenticate, authorizeRoles("superadmin", "hr"), getEmployees);
router.get("/users/team", authenticate, authorizeRoles("admin", "hr", "superadmin"), getDepartmentEmployees);

export default router;

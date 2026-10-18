// src/middlewares/requireRole.js
// Use AFTER authenticateUser:
//   router.post("/", authenticateUser, requirePermission("projects.create"), handler)
// Permissions are defined in config/roles.js. Hiding a menu in the frontend
// is not security; these checks are.

import { hasPermission } from "../config/roles.js";

export const requirePermission =
  (...permissions) =>
  (req, res, next) => {
    const role = req.user?.role;
    if (!role || !permissions.some((p) => hasPermission(role, p))) {
      return res.status(403).json({ success: false, message: "You do not have permission for this action." });
    }
    next();
  };

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    const role = req.user?.role;
    if (!role || (role !== "admin" && !roles.includes(role))) {
      return res.status(403).json({ success: false, message: "You do not have permission for this action." });
    }
    next();
  };

export const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, message: "Only the Admin can do this." });
  }
  next();
};

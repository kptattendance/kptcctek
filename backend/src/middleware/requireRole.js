// src/middlewares/requireRole.js
// Use AFTER authenticateUser.  e.g.  router.get("/x", authenticateUser, requireRole("coe"), handler)
//
// Admin may see and do everything any other role can.
// Sensitive work (deleting, reopening marks) uses adminOnly instead.

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    const role = req.user?.role;
    if (!role || (role !== "admin" && !roles.includes(role))) {
      return res.status(403).json({ error: "You do not have permission for this action." });
    }
    next();
  };

// Only the Admin: deleting records, undoing an import, reopening entered marks
export const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Only the Admin can do this. Please ask the Admin." });
  }
  next();
};

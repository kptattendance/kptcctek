// src/routes/accountRoutes.js   mounted at /api/users
// Every route needs a signed-in, registered, active user; managing people
// additionally needs "users.manage". Create/edit accept an optional "photo"
// file (multipart/form-data).

import express from "express";
import { authenticateUser } from "../middlewares/requireAuth.js";
import { requirePermission } from "../middlewares/requireRole.js";
import { uploadAvatarFile } from "../middlewares/uploadAvatar.js";
import {
  getMe, getOptions, listUsers, listStaffOptions, getUser, createUser, updateUser, deleteUser,
} from "../controllers/accountController.js";

const router = express.Router();
const manage = requirePermission("users.manage");

router.use(authenticateUser);

router.get("/me", getMe);
router.get("/options", manage, getOptions);
router.get("/staff-options", requirePermission("projects.assign", "assignments.manage"), listStaffOptions);

router.get("/", manage, listUsers);
router.post("/", manage, uploadAvatarFile, createUser);
router.get("/:id", manage, getUser);
router.patch("/:id", manage, uploadAvatarFile, updateUser);
router.delete("/:id", manage, deleteUser);

export default router;

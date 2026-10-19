// src/routes/deskRoutes.js   mounted at /api/desk

import express from "express";
import { authenticateUser } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { managerDesk, principalDesk } from "../controllers/deskController.js";

const router = express.Router();
router.use(authenticateUser);

// requireRole always lets the Admin in
router.get("/manager", requireRole("manager"), managerDesk);
router.get("/principal", requireRole("approver", "manager"), principalDesk);

export default router;

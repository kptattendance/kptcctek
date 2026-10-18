// src/routes/projectRoutes.js   mounted at /api/projects

import express from "express";
import rateLimit from "express-rate-limit";
import { authenticateUser } from "../middlewares/requireAuth.js";
import { requirePermission } from "../middlewares/requireRole.js";
import { uploadScanFile } from "../middlewares/uploadScan.js";
import {
  listParties, getDirectory, scanInward, coordinatorSummary, assignTeam, changeStatus, mySummary, getScanUrl, nextNumbers, previewCharges, createProject, listProjects, getProject,
} from "../controllers/projectController.js";

const router = express.Router();
router.use(authenticateUser);

// Each scan costs storage + an AI call: cap it per user.
const scanLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  keyGenerator: (req) => String(req.user?.dbId),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many scans in a short time. Please wait a few minutes." },
});

const canCreate = requirePermission("projects.create");

router.get("/parties", listParties);
router.post("/scan", canCreate, scanLimit, uploadScanFile, scanInward);
router.get("/scans/:scanId/url", getScanUrl);
router.get("/next-numbers", canCreate, nextNumbers);
router.get("/directory", canCreate, getDirectory);
router.post("/preview-charges", canCreate, previewCharges);

const canAssign = requirePermission("projects.assign", "assignments.manage");
router.get("/coordinator/summary", canAssign, coordinatorSummary);
router.get("/my/summary", mySummary);

router.get("/", listProjects); // faculty are limited to their own jobs inside
router.post("/", canCreate, createProject);
router.get("/:id", getProject);
router.post("/:id/assign", canAssign, assignTeam);
router.post("/:id/status", changeStatus); // team members: own job -> inspected only (checked inside)

export default router;

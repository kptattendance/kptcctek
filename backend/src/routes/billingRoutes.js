// src/routes/billingRoutes.js   mounted at /api/billing

import express from "express";
import { authenticateUser } from "../middlewares/requireAuth.js";
import { requirePermission, adminOnly } from "../middlewares/requireRole.js";
import {
  readyToBill, listBills, getBill, createBill, nextBillNumber, issueBill, markSent, cancelBill,
  recordReceipt, reverseReceipt, listReceipts,
  pendingDistribution, createStatement, listStatements, getStatement, approveStatement, disburseStatement, cancelStatement, deleteStatement, myEarnings,
  overview, readSettings, updateSettings, listAllParties, updateParty,
} from "../controllers/billingController.js";
import {
  getFunds, createFund, updateFund,
  listGroups, groupCandidates, createGroup, getGroup, recordGroupReceipt, reverseGroupReceipt, markGroupSent, cancelGroup,
} from "../controllers/billGroupController.js";

const router = express.Router();
router.use(authenticateUser);

const read = requirePermission("billing.read");
const prepare = requirePermission("billing.prepare");
const receipts = requirePermission("receipts.manage");
const payPrepare = requirePermission("payouts.prepare");
const payApprove = requirePermission("payouts.approve");
const payRead = requirePermission("payouts.read");

router.get("/overview", requirePermission("reports.read"), overview);
router.get("/my-earnings", myEarnings); // everyone sees only their own

router.get("/ready", prepare, readyToBill);
router.get("/bills", read, listBills);
router.post("/bills", prepare, createBill);
router.get("/bills/next-number", prepare, nextBillNumber);
router.get("/bills/:id", read, getBill);
router.post("/bills/:id/issue", prepare, issueBill);
router.post("/bills/:id/sent", prepare, markSent);
router.post("/bills/:id/cancel", prepare, cancelBill);
router.post("/bills/:id/receipts", receipts, recordReceipt);

// Statement of Bills: one party + one fund, one cheque
router.get("/groups", read, listGroups);
router.get("/groups/candidates", prepare, groupCandidates);
router.post("/groups", prepare, createGroup);
router.get("/groups/:id", read, getGroup);
router.post("/groups/:id/receipts", receipts, recordGroupReceipt);
router.post("/groups/:id/receipts/:batch/reverse", receipts, reverseGroupReceipt);
router.post("/groups/:id/sent", prepare, markGroupSent);
router.post("/groups/:id/cancel", prepare, cancelGroup);

router.get("/receipts", read, listReceipts);
router.post("/receipts/:id/reverse", receipts, reverseReceipt);

router.get("/distribution/pending", payRead, pendingDistribution);
router.get("/statements", payRead, listStatements);
router.post("/statements", payPrepare, createStatement);
router.get("/statements/:id", payRead, getStatement);
router.post("/statements/:id/approve", payApprove, approveStatement);
router.post("/statements/:id/disburse", requirePermission("payouts.prepare", "payouts.approve"), disburseStatement);
router.post("/statements/:id/cancel", requirePermission("payouts.prepare", "payouts.approve"), cancelStatement);
router.delete("/statements/:id", adminOnly, deleteStatement);

router.get("/settings", read, readSettings);
router.put("/settings", requirePermission("settings.manage"), updateSettings);
router.get("/funds", read, getFunds);
router.post("/funds", requirePermission("settings.manage"), createFund);
router.put("/funds/:id", requirePermission("settings.manage"), updateFund);
router.get("/parties", read, listAllParties);
router.put("/parties/:id", requirePermission("parties.manage"), updateParty);

export default router;

/**
 * CCTEK application roles.
 *
 * admin            - System administration
 * manager          - CCTEK project and operational management
 * office_staff     - Incoming work and office records
 * work_coordinator - Technical work allocation and supervision
 * faculty          - Assigned technical work
 * accounts         - Billing, receipts and payment records
 * approver         - Principal: approves remuneration statements
 * auditor          - Read-only review
 */

export const ROLE_LABELS = {
  admin: "System Administrator",
  manager: "CCTEK Manager",
  office_staff: "CCTEK Office Staff",
  work_coordinator: "Work Coordinator",
  faculty: "College Staff / Faculty",
  accounts: "Accounts and Billing Staff",
  approver: "Principal / Approver",
  auditor: "Auditor / Read-only Reviewer",
};

export const ROLES = Object.keys(ROLE_LABELS);

// Normalize incoming role values before validating them.
export const normalizeRole = (role) => {
  const value = String(role ?? "").trim().toLowerCase();

  const aliases = {
    administrator: "admin",
    coordinator: "work_coordinator",
    technical_coordinator: "work_coordinator",
    office: "office_staff",
    staff: "faculty",
    accountant: "accounts",
    reviewer: "approver",
    viewer: "auditor",
  };

  const normalized = aliases[value] || value;

  return ROLES.includes(normalized) ? normalized : null;
};

// Role checks must be enforced by backend middleware/controllers.
// Hiding a frontend menu is not an authorization mechanism.
// Who does what in billing:
//   Work coordinator / office staff: make bills, record cheques, prepare the
//     monthly remuneration statement.
//   Principal (approver) / Manager: approve statements, see the overview.
//   Nobody approves a statement they prepared (checked in the controller).
export const ROLE_PERMISSIONS = {
  admin: [
    "users.manage",
    "settings.manage",
    "parties.manage",
    "rules.manage",
    "projects.read",
    "projects.create",
    "projects.update",
    "projects.assign",
    "assignments.manage",
    "billing.read",
    "billing.prepare",
    "receipts.manage",
    "payouts.read",
    "payouts.prepare",
    "payouts.approve",
    "reports.read",
    "audit.read",
  ],

  manager: [
    "settings.manage",
    "parties.manage",
    "projects.read",
    "projects.create",
    "projects.update",
    "projects.assign",
    "assignments.read",
    "assignments.manage",
    "billing.read",
    "billing.prepare",
    "receipts.manage",
    "payouts.read",
    "payouts.prepare",
    "payouts.approve",
    "reports.read",
  ],

  office_staff: [
    "projects.read",
    "projects.create",
    "projects.update",
    "documents.manage",
    "correspondence.manage",
    "billing.read",
    "billing.prepare",
    "receipts.manage",
    "payouts.read",
    "payouts.prepare",
  ],

  work_coordinator: [
    "projects.read",
    "assignments.read",
    "assignments.manage",
    "documents.manage",
    "billing.read",
    "billing.prepare",
    "receipts.manage",
    "payouts.read",
    "payouts.prepare",
    "reports.read",
  ],

  faculty: [
    "payouts.own.read",
    "projects.assigned.read",
    "assignments.own.read",
    "assignments.own.update",
    "documents.own.manage",
  ],

  accounts: [
    "projects.read",
    "billing.read",
    "billing.prepare",
    "receipts.manage",
    "payouts.read",
    "payouts.prepare",
    "reports.read",
  ],

  approver: [
    "projects.read",
    "assignments.read",
    "billing.read",
    "payouts.read",
    "payouts.approve",
    "reports.read",
  ],

  auditor: [
    "projects.read",
    "assignments.read",
    "billing.read",
    "payouts.read",
    "reports.read",
    "audit.read",
  ],
};

export const permissionsFor = (role) => ROLE_PERMISSIONS[normalizeRole(role)] || [];

export const hasPermission = (role, permission) => {
  const normalized = normalizeRole(role);

  return Boolean(
    normalized &&
      ROLE_PERMISSIONS[normalized]?.includes(permission)
  );
};
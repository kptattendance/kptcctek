// Where each role lands after sign-in (/auth/check). Keys must match
// backend/src/config/roles.js. Pages not built yet fall back to /auth/check.
export const HOME_BY_ROLE = {
  admin: "/manager",
  manager: "/manager",
  office_staff: "/office/incoming",
  work_coordinator: "/coordinator",
  faculty: "/faculty",
  accounts: "/billing/bills",
  approver: "/principal",
  auditor: "/overview",
};

export const DEFAULT_DASHBOARD = "/auth/check";

// Sidebar: each person sees only the sections their role can use (admin sees
// all). Coordinators and managers can also be put on inspection teams, so
// they get "My inspections" too. Icons are mapped by name in AppShell.
export const SECTIONS = [
  {
    title: "My desk",
    kn: "ನನ್ನ ಮೇಜು",
    roles: ["manager", "approver"],
    items: [
      { href: "/manager", label: "Manager desk", kn: "ವ್ಯವಸ್ಥಾಪಕರ ಮೇಜು", icon: "Gauge", roles: ["manager"] },
      { href: "/principal", label: "Principal's desk", kn: "ಪ್ರಾಂಶುಪಾಲರ ಮೇಜು", icon: "Landmark", roles: ["approver", "manager"] },
    ],
  },
  {
    title: "Office",
    kn: "ಕಚೇರಿ",
    roles: ["office_staff", "manager"],
    items: [
      { href: "/office/incoming", label: "Incoming letter", kn: "ಒಳಬಂದ ಅರ್ಜಿ", icon: "ScanLine" },
      { href: "/office/register", label: "Register", kn: "ನೋಂದಣಿ ಪುಸ್ತಕ", icon: "ListChecks" },
    ],
  },
  {
    title: "Coordination",
    kn: "ಸಮನ್ವಯ",
    roles: ["work_coordinator", "manager"],
    items: [{ href: "/coordinator", label: "Assign & track", kn: "ನಿಯೋಜನೆ ಮತ್ತು ಅನುಸರಣೆ", icon: "UsersRound" }],
  },
  {
    title: "Billing",
    kn: "ಬಿಲ್ಲಿಂಗ್",
    roles: ["work_coordinator", "office_staff", "manager", "accounts", "approver", "auditor"],
    items: [
      { href: "/billing", label: "Ready to bill", kn: "ಬಿಲ್ ಮಾಡಬೇಕಾದವು", icon: "FilePlus2", roles: ["work_coordinator", "office_staff", "manager", "accounts"] },
      { href: "/billing/bills", label: "Bills", kn: "ಬಿಲ್‌ಗಳು", icon: "FileText" },
      { href: "/billing/receipts", label: "Cheques received", kn: "ಸ್ವೀಕರಿಸಿದ ಚೆಕ್‌ಗಳು", icon: "Wallet" },
      { href: "/billing/distribution", label: "Distribution", kn: "ಹಂಚಿಕೆ", icon: "HandCoins" },
      { href: "/billing/settings", label: "Bill settings", kn: "ಬಿಲ್ ವಿವರಗಳು", icon: "Settings", roles: ["manager"] },
    ],
  },
  {
    title: "Overview",
    kn: "ಸಾರಾಂಶ",
    roles: ["manager", "approver", "auditor", "accounts", "work_coordinator"],
    items: [{ href: "/overview", label: "Money overview", kn: "ಹಣಕಾಸು ಸಾರಾಂಶ", icon: "PieChart" }],
  },
  {
    title: "Administration",
    kn: "ಆಡಳಿತ",
    roles: [],
    items: [{ href: "/admin/users", label: "Users", kn: "ಬಳಕೆದಾರರು", icon: "Users" }],
  },
];
export function sectionsFor(role) {
  const ok = (roles) => role === "admin" || roles.includes(role);
  return SECTIONS.filter((s) => ok(s.roles))
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.roles || ok(i.roles)) }))
    .filter((s) => s.items.length);
}

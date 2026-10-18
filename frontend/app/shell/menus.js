// Where each role lands after sign-in (/auth/check). Keys must match
// backend/src/config/roles.js. Pages not built yet fall back to /auth/check.
export const HOME_BY_ROLE = {
  admin: "/admin/dashboard",
  manager: "/admin/dashboard",
  office_staff: "/office/incoming",
  work_coordinator: "/coordinator",
  faculty: "/faculty",
  accounts: "/accounts/dashboard",
  approver: "/approvals/dashboard",
  auditor: "/reports/dashboard",
};

export const DEFAULT_DASHBOARD = "/auth/check";

// Sidebar: each person sees only the sections their role can use (admin sees
// all). Coordinators and managers can also be put on inspection teams, so
// they get "My inspections" too. Icons are mapped by name in AppShell.
export const SECTIONS = [
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
    title: "My work",
    kn: "ನನ್ನ ಕೆಲಸ",
    roles: ["faculty", "work_coordinator", "manager"],
    items: [{ href: "/faculty", label: "My inspections", kn: "ನನ್ನ ತಪಾಸಣೆಗಳು", icon: "ClipboardCheck" }],
  },
  {
    title: "Administration",
    kn: "ಆಡಳಿತ",
    roles: ["manager"],
    items: [
      { href: "/admin/dashboard", label: "Admin dashboard", kn: "ಆಡಳಿತ ಫಲಕ", icon: "LayoutDashboard" },
      { href: "/admin/users", label: "Users", kn: "ಬಳಕೆದಾರರು", icon: "Users", roles: [] }, // admin only
    ],
  },
];

export function sectionsFor(role) {
  const ok = (roles) => role === "admin" || roles.includes(role);
  return SECTIONS.filter((s) => ok(s.roles))
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.roles || ok(i.roles)) }))
    .filter((s) => s.items.length);
}

import AppShell from "../components/shell/AppShell";
import RoleGate from "../components/shell/RoleGate";

export const metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

// Users is admin-only (RoleGate always lets admin in); "New application"
// here is also open to the manager.
export default function AdminLayout({ children }) {
  return (
    <AppShell>
      <RoleGate allow={["manager"]}>{children}</RoleGate>
    </AppShell>
  );
}

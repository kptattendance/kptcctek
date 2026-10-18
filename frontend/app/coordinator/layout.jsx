import AppShell from "../components/shell/AppShell";
import RoleGate from "../components/shell/RoleGate";

export const metadata = {
  title: "Assign & track",
  robots: { index: false, follow: false },
};

export default function CoordinatorLayout({ children }) {
  return (
    <AppShell>
      <RoleGate allow={["manager", "work_coordinator"]}>{children}</RoleGate>
    </AppShell>
  );
}

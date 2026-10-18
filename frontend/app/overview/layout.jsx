import AppShell from "../components/shell/AppShell";
import RoleGate from "../components/shell/RoleGate";

export const metadata = {
  title: "Money overview",
  robots: { index: false, follow: false },
};

export default function OverviewLayout({ children }) {
  return (
    <AppShell>
      <RoleGate allow={["manager", "approver", "auditor", "accounts", "work_coordinator"]}>{children}</RoleGate>
    </AppShell>
  );
}

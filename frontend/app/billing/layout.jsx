import AppShell from "../components/shell/AppShell";
import RoleGate from "../components/shell/RoleGate";

export const metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

export default function BillingLayout({ children }) {
  return (
    <AppShell>
      <RoleGate allow={["manager", "work_coordinator", "office_staff", "accounts", "approver", "auditor"]}>{children}</RoleGate>
    </AppShell>
  );
}

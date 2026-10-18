import AppShell from "../components/shell/AppShell";
import RoleGate from "../components/shell/RoleGate";

export const metadata = {
  title: "Office",
  robots: { index: false, follow: false },
};

export default function OfficeLayout({ children }) {
  return (
    <AppShell>
      <RoleGate allow={["manager", "office_staff"]}>{children}</RoleGate>
    </AppShell>
  );
}

import AppShell from "../components/shell/AppShell";
import RoleGate from "../components/shell/RoleGate";

export const metadata = {
  title: "Principal's desk",
  robots: { index: false, follow: false },
};

export default function PrincipalLayout({ children }) {
  return (
    <AppShell>
      <RoleGate allow={["approver", "manager"]}>{children}</RoleGate>
    </AppShell>
  );
}

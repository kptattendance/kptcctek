import AppShell from "../components/shell/AppShell";
import RoleGate from "../components/shell/RoleGate";

export const metadata = {
  title: "Manager desk",
  robots: { index: false, follow: false },
};

export default function ManagerLayout({ children }) {
  return (
    <AppShell>
      <RoleGate allow={["manager"]}>{children}</RoleGate>
    </AppShell>
  );
}

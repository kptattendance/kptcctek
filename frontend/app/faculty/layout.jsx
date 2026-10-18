import AppShell from "../components/shell/AppShell";
import RoleGate from "../components/shell/RoleGate";

export const metadata = {
  title: "My inspections",
  robots: { index: false, follow: false },
};

export default function FacultyLayout({ children }) {
  return (
    <AppShell>
      <RoleGate allow={["faculty", "work_coordinator", "manager"]}>{children}</RoleGate>
    </AppShell>
  );
}

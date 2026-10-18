// Admin sidebar "New Project" uses the same intake screen as office staff.
import IncomingApplication from "@/app/components/intake/IncomingApplication";

export const metadata = { title: "New application" };

export default function AdminNewProjectPage() {
  return <IncomingApplication />;
}

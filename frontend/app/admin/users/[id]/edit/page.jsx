import { Suspense } from "react";
import UserForm from "@/app/components/users/UserForm";

export const metadata = { title: "Edit user" };

// params is a Promise in Next 16; read it inside Suspense (cacheComponents).
async function EditUser({ params }) {
  const { id } = await params;
  return <UserForm userId={id} />;
}

export default function EditUserPage({ params }) {
  return (
    <Suspense fallback={null}>
      <EditUser params={params} />
    </Suspense>
  );
}

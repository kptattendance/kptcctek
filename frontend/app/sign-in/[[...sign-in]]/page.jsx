import { Suspense } from "react";
import { SignIn } from "@clerk/nextjs";

export const metadata = {
  title: "Sign In",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignInPage() {
  return (
    <section className="flex min-h-[75vh] items-center justify-center bg-amber-50 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-amber-100 bg-white p-6 shadow-xl shadow-amber-900/5 sm:p-8">
        <h1 className="mb-2 text-center text-2xl font-extrabold text-slate-900">
          Welcome to CCTEK
        </h1>

        <p className="mb-7 text-center text-sm text-slate-500">
          Sign in to access your authorized workspace.
        </p>

        <div className="flex justify-center">
          {/* SignIn reads the URL; cacheComponents needs it inside Suspense */}
          <Suspense fallback={<p className="text-sm text-slate-500">Loading sign-in...</p>}>
            <SignIn />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
import Link from "next/link";

// Fixed at build time; cacheComponents forbids new Date() while prerendering.
const COPYRIGHT_YEAR = 2026;

const features = [
  {
    number: "01",
    title: "Project Register",
    description:
      "Maintain project applications, client details, project values, reference numbers and important dates in one organized register.",
  },
  {
    number: "02",
    title: "Faculty Assignments",
    description:
      "Assign multiple faculty members to projects, define responsibilities, set deadlines and track work completion.",
  },
  {
    number: "03",
    title: "Billing Management",
    description:
      "Maintain service-charge calculations, bill records, bill revisions and approval status with a clear financial history.",
  },
  {
    number: "04",
    title: "Receipts & Payments",
    description:
      "Track receipts, partial payments, outstanding amounts and payment dates against individual bills.",
  },
  {
    number: "05",
    title: "Documents",
    description:
      "Organize project documents, inspection reports and supporting files associated with each project.",
  },
  {
    number: "06",
    title: "Reports & Monitoring",
    description:
      "Review project progress, faculty workload, billing status and year-wise financial summaries.",
  },
];

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "CCTEK",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "A project and billing management platform for tracking project records, faculty assignments, billing, receipts and financial reports.",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />

      <section className="relative overflow-hidden bg-amber-50">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-amber-200/50 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-2 lg:px-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              One platform. Complete project visibility.
            </span>

            <h1 className="mt-7 max-w-2xl text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Manage projects and billing with{" "}
              <span className="text-amber-600">greater clarity.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              CCTEK brings project registration, faculty work allocation,
              document management, billing records and payment tracking
              together in one centralized workspace.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                href="/sign-in"
                className="rounded-xl bg-amber-400 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-amber-500"
              >
                Access CCTEK
                <span className="ml-2" aria-hidden="true">
                  →
                </span>
              </Link>

              <a
                href="#features"
                className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-amber-400 hover:bg-amber-50"
              >
                Explore features
              </a>
            </div>

            <p className="mt-5 text-xs leading-5 text-slate-500">
              Authorized users only. Access to project and financial records
              is controlled by assigned permissions.
            </p>
          </div>

          <div className="mx-auto w-full max-w-xl">
            <div className="rounded-3xl border border-amber-200 bg-white p-5 shadow-xl shadow-amber-900/5 sm:p-7">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    WORKSPACE OVERVIEW
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    Your projects, organized
                  </h2>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
                  <span aria-hidden="true">▦</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                {[
                  ["Projects", "01"],
                  ["Assignments", "02"],
                  ["Billing", "03"],
                  ["Reports", "04"],
                ].map(([title, number]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-sm font-extrabold text-amber-800">
                      {number}
                    </div>
                    <p className="mt-4 font-semibold text-slate-800">
                      {title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Centralized management
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl bg-amber-50 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  Connected project workflow
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  From project registration and faculty assignment to bill
                  preparation and payment tracking.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="scroll-mt-20 bg-white px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-700">
              CCTEK capabilities
            </p>

            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              Everything connected to your project workflow
            </h2>

            <p className="mt-5 leading-7 text-slate-600">
              Maintain a structured record of project activities, assigned
              responsibilities, financial transactions and supporting
              documents throughout the project lifecycle.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.number}
                className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-amber-300 hover:shadow-lg hover:shadow-amber-900/5"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-sm font-extrabold text-amber-800 transition group-hover:bg-amber-400">
                  {feature.number}
                </span>

                <h3 className="mt-5 text-lg font-bold text-slate-900">
                  {feature.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-7 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">
              A clearer way to manage project work
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-slate-300">
              Bring project records, assignments and financial information
              into a consistent workflow.
            </p>
          </div>

          <Link
            href="/sign-in"
            className="shrink-0 rounded-xl bg-amber-400 px-6 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-amber-300"
          >
            Sign in to CCTEK →
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {COPYRIGHT_YEAR} CCTEK. All rights reserved.
          </p>
          <p>Project & Billing Management</p>
        </div>
      </footer>
    </>
  );
}
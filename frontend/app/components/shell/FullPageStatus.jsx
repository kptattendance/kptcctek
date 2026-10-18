export default function FullPageStatus({
  title = "Please wait",
  message = "We are checking your access...",
}) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-amber-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-amber-200 border-t-amber-500" />

        <h1 className="text-xl font-bold text-slate-900">{title}</h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
      </div>
    </main>
  );
}
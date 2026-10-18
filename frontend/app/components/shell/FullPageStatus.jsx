export default function FullPageStatus({
  title = "Please wait",
  message = "We are checking your access...",
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="cc-card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-cc-primary-soft border-t-cc-primary" />
        <h1 className="text-xl font-bold text-cc-text">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-cc-muted">{message}</p>
      </div>
    </div>
  );
}

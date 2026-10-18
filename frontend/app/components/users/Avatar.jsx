// Round profile photo, or initials when there is none.
export default function Avatar({ name = "", src, size = 44 }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className="neu-raised-sm shrink-0 rounded-full object-cover p-0.5" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="neu-raised-sm flex shrink-0 items-center justify-center rounded-full font-bold text-neu-accent"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  );
}

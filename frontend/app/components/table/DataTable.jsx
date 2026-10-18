"use client";

// Compact table used by every list screen.
//   columns: [{ key, header, kn?, render?(row), sortKey?, className?, hideBelow?: "md" | "lg" | "xl" }]
// Sorting and paging are done on the server; the table only reports clicks.
// Rows open a details panel (onRowClick) so the table itself stays short.

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";

const HIDE = { md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" };

export default function DataTable({
  columns, rows, rowKey = "_id", loading, sort, onSort, onRowClick, emptyText = "Nothing to show.", page = 1, pages = 1, total, onPage,
}) {
  return (
    <div className="neu-raised overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left">
              {columns.map((c) => {
                const active = sort?.key && sort.key === c.sortKey;
                const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={`whitespace-nowrap px-4 py-3 align-bottom text-xs font-bold uppercase tracking-wide text-neu-muted ${HIDE[c.hideBelow] || ""} ${c.className || ""}`}
                  >
                    {c.sortKey && onSort ? (
                      <button type="button" onClick={() => onSort(c.sortKey)} className="inline-flex items-center gap-1 uppercase hover:text-neu-text">
                        {c.header}
                        <Icon size={13} className={active ? "text-neu-accent" : "opacity-50"} aria-hidden />
                      </button>
                    ) : (
                      c.header
                    )}
                    {c.kn && <span className="block text-[11px] font-semibold normal-case tracking-normal text-neu-muted/80">{c.kn}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="p-10 text-center">
                  <LoaderCircle className="mx-auto animate-spin text-neu-accent" aria-label="Loading" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-10 text-center text-neu-muted">{emptyText}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row[rowKey]}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget && (e.preventDefault(), onRowClick(row)) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={`border-b border-black/5 last:border-0 ${onRowClick ? "cursor-pointer hover:bg-white/50 focus:bg-white/60 focus:outline-none" : ""}`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 align-middle ${HIDE[c.hideBelow] || ""} ${c.className || ""}`}>
                      {c.render ? c.render(row) : row[c.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(pages > 1 || total != null) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/5 px-4 py-3 text-sm">
          <span className="text-neu-muted">{total != null ? `${total} record${total === 1 ? "" : "s"}` : ""}</span>
          {pages > 1 && (
            <span className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page" className="neu-raised-sm neu-press p-2 disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              <span className="tabular-nums text-neu-muted">
                {page} / {pages}
              </span>
              <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page" className="neu-raised-sm neu-press p-2 disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- filter controls

export function FilterBar({ children, onClear, active }) {
  return (
    <div className="neu-raised flex flex-wrap items-end gap-3 p-4">
      {children}
      {active && (
        <button type="button" onClick={onClear} className="neu-raised-sm neu-press px-4 py-2.5 text-sm font-semibold text-neu-muted">
          Clear filters
        </button>
      )}
    </div>
  );
}

const ctl = "neu-inset w-full px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-neu-accent";

export function FilterSearch({ value, onChange, placeholder }) {
  return (
    <label className="min-w-[200px] flex-[2]">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neu-muted">Search · ಹುಡುಕಿ</span>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={ctl} />
    </label>
  );
}

export function FilterSelect({ label, kn, value, onChange, options, allLabel = "All" }) {
  return (
    <label className="min-w-[140px] flex-1">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neu-muted">
        {label}
        {kn ? ` · ${kn}` : ""}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={ctl}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function FilterInput({ label, kn, value, onChange, type = "text", ...rest }) {
  return (
    <label className="min-w-[120px] flex-1">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neu-muted">
        {label}
        {kn ? ` · ${kn}` : ""}
      </span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={ctl} {...rest} />
    </label>
  );
}

// Status pills with counts, used above the table
export function StatusTabs({ tabs, value, onChange, counts = {} }) {
  return (
    <div role="tablist" aria-label="Stage" className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold ${active ? "neu-inset text-neu-text" : "neu-raised-sm neu-press text-neu-text/80"}`}
          >
            <span>
              {t.label}
              {t.kn && <span className="block text-[11px] font-medium text-neu-muted">{t.kn}</span>}
            </span>
            {counts[t.key] != null && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums ${active ? "bg-amber-100 text-amber-900" : "bg-black/5"}`}>{counts[t.key]}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

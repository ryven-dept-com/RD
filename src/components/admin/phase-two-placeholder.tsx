export function PhaseTwoSection({
  title,
  description,
  planned,
}: {
  title: string;
  description: string;
  planned: string[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
            Phase 2
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Planned for Phase 2</h2>
        <ul className="mt-4 space-y-3">
          {planned.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-slate-600">
              <svg
                className="mt-0.5 shrink-0 text-slate-400"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 12l2 2 4-4" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        This section has no backing tables in the current database schema, so no
        data is displayed here yet — the Admin Panel never shows invented
        figures. Management tools will appear automatically once the Phase 2
        schema and APIs land.
      </div>
    </div>
  );
}

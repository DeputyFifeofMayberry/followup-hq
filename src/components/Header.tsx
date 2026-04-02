import { useAppStore } from '../store/useAppStore';

export function Header() {
  const total = useAppStore((s) => s.items.length);

  return (
    <header className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Daily execution workspace</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">FollowUp HQ</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Start with today’s queue, execute next actions fast, and keep follow-ups + tasks in sync without extra overhead.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {total} tracked records
        </div>
      </div>
    </header>
  );
}

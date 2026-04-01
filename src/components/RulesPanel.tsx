export function RulesPanel() {
  const rules = [
    'If a waiting item passes its touch cadence, push it into Needs nudge automatically.',
    'If promised date slips or due date passes, raise escalation pressure before the item disappears.',
    'Keep contacts and companies linked to the work so repeat blockers show up across projects.',
    'Generate copy-ready weekly project reports from the live tracker, not a separate spreadsheet.',
  ];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-950">Automation foundation</h2>
        <p className="mt-1 text-sm text-slate-500">The app is now centered on accountability, relationships, and project risk instead of mailbox sync.</p>
      </div>
      <div className="grid gap-3 p-4">
        {rules.map((rule) => (
          <div key={rule} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
            {rule}
          </div>
        ))}
      </div>
    </section>
  );
}

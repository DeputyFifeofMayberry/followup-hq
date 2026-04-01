export function IngestionWorkbench() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-950">Source ingestion workbench</h2>
        <p className="mt-1 text-sm text-slate-500">Use the unified intake panel to drag and drop emails, paste notes, or import Excel issues. Live connectors are intentionally out of the main workflow now.</p>
      </div>
      <div className="p-4 text-sm text-slate-600">
        Drag and drop local email files, import CSV/Excel, and convert raw intake signals into tracked follow-ups.
      </div>
    </section>
  );
}

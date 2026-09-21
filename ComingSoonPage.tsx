export default function ComingSoonPage({ note }: { title?: string; note?: string }) {
  return (
    <div className="space-y-4">
      <div className="ledger-card p-8 text-center">
        <p className="text-ink-muted">
          This page is on the build list but not wired up to the backend yet.
        </p>
        {note && <p className="text-ink-muted text-sm mt-2">{note}</p>}
      </div>
    </div>
  );
}

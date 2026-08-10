export default function NotificationsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Notifications</h2>
      <div className="ledger-card p-8 text-center">
        <p className="text-ink-muted">
          The backend already logs every reminder/OTP "intent" (e.g. password resets) to a database table —
          nothing is actually sent via WhatsApp/SMS/Email yet (see NOTIFICATIONS.md). This page just needs an
          admin-only API route added to list that table; ask me and I'll wire it up.
        </p>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import client from '../api/client';
import type { NotificationRow, ManagementSplit } from '../types';

const CHANNEL_LABEL: Record<string, string> = { SMS: 'SMS', WHATSAPP: 'WhatsApp', EMAIL: 'Email', PUSH: 'Push' };
const STATUS_STYLES: Record<string, string> = {
  LOGGED: 'bg-line text-ink-muted',
  PENDING: 'bg-gold/15 text-gold-dim',
  FAILED: 'bg-danger/10 text-danger',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRow[] | null>(null);
  const [mgmt, setMgmt] = useState<ManagementSplit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    client
      .get('/notifications')
      .then((res) => setNotifications(res.data.data))
      .catch((err) => setError(err?.response?.status === 403 ? "You don't have access to view notifications." : 'Could not load notifications.'));
    // Independent of the list above - if this fails (e.g. before migration
    // 016 is run), the Management column just falls back to not shown
    // rather than breaking the whole page.
    client
      .get('/funds/management-split')
      .then((res) => setMgmt(res.data.data))
      .catch(() => setMgmt(null));
  }, []);

  const boundary = mgmt?.boundaryDate || '2026-07-01';

  return (
    <div className="space-y-4">
      <p className="text-ink-muted text-sm">
        Every reminder/OTP "intent" the app has logged (e.g. password resets, drawer assignments) — nothing is
        actually sent via WhatsApp/SMS/Email yet, see NOTIFICATIONS.md for how to go live.
      </p>

      {error && <p className="text-sm text-danger">{error}</p>}

      {!error && !notifications && <p className="text-ink-muted">Loading…</p>}

      {!error && notifications && notifications.length === 0 && (
        <div className="ledger-card p-8 text-center">
          <p className="text-ink-muted">No notifications have been logged yet.</p>
        </div>
      )}

      {!error && notifications && notifications.length > 0 && (
        <div className="ledger-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-navy text-white text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Recipient</th>
                <th className="text-left px-4 py-3">Channel</th>
                <th className="text-left px-4 py-3">Message</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Management</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n, idx) => {
                // Same cut-off the rest of the app uses (Dashboard/Fund/
                // Report) - a notification logged on/after 1 Jul 2026
                // belongs to New Management, everything before it to
                // Previous Management. Purely a label here; it doesn't
                // change what was logged or move it between tables.
                const isNew = n.created_at >= boundary;
                return (
                  <tr key={n.id} className={`border-t border-line ${idx % 2 === 0 ? 'bg-white' : 'bg-paper/50'}`}>
                    <td className="px-4 py-3 text-ink-muted whitespace-nowrap">
                      {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 font-medium">{n.member_name || '—'}</td>
                    <td className="px-4 py-3">{CHANNEL_LABEL[n.channel] || n.channel}</td>
                    <td className="px-4 py-3 max-w-md">
                      {n.subject && <div className="font-medium">{n.subject}</div>}
                      <div className="text-ink-muted truncate">{n.body}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[n.status] || 'bg-line text-ink-muted'}`}>
                        {n.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${isNew ? 'bg-navy/10 text-navy' : 'bg-line text-ink-muted'}`}>
                        {isNew ? 'New Management' : 'Previous Management'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import client from '../api/client';
import type { NotificationRow, Member } from '../types';
import { useAuth } from '../context/AuthContext';

const CHANNEL_LABEL: Record<string, string> = { SMS: 'SMS', WHATSAPP: 'WhatsApp', EMAIL: 'Email', PUSH: 'Push' };
const STATUS_STYLES: Record<string, string> = {
  LOGGED: 'bg-line text-ink-muted',
  PENDING: 'bg-gold/15 text-gold-dim',
  FAILED: 'bg-danger/10 text-danger',
};

const EMPTY_FORM = { memberId: '', channel: 'WHATSAPP', subject: '', body: '' };

export default function NotificationsPage() {
  const { user } = useAuth();
  // Admin-only for now, per current requirement - the backend enforces
  // this too, this is just to hide the option from the UI for everyone
  // else. Widening this to other roles later is a one-line change here
  // plus the matching authorize() call in notification.routes.js.
  const canCreate = user?.role === 'ADMIN';

  const [notifications, setNotifications] = useState<NotificationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function load() {
    client
      .get('/notifications')
      .then((res) => setNotifications(res.data.data))
      .catch((err) => setError(err?.response?.status === 403 ? "You don't have access to view notifications." : 'Could not load notifications.'));
  }

  useEffect(load, []);

  useEffect(() => {
    if (canCreate && showForm && members.length === 0) {
      client.get('/members').then((res) => setMembers(res.data.data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSending(true);
    try {
      await client.post('/notifications', {
        memberId: form.memberId,
        channel: form.channel,
        subject: form.subject || undefined,
        body: form.body,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Could not create this notification.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-ink-muted text-sm">
          Every reminder/OTP "intent" the app has logged (e.g. password resets, drawer assignments) — nothing is
          actually sent via WhatsApp/SMS/Email yet, see NOTIFICATIONS.md for how to go live.
        </p>
        {canCreate && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-navy text-white px-4 py-2 text-sm font-medium hover:bg-navy-light transition-colors cursor-pointer whitespace-nowrap"
          >
            {showForm ? 'Cancel' : '+ New notification'}
          </button>
        )}
      </div>

      {showForm && canCreate && (
        <form onSubmit={handleSend} className="ledger-card p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select
              required
              value={form.memberId}
              onChange={(e) => setForm({ ...form, memberId: e.target.value })}
              className="rounded-lg border border-line px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select recipient…
              </option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.mobileNumber}
                </option>
              ))}
            </select>
            <select
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
              className="rounded-lg border border-line px-3 py-2 text-sm"
            >
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SMS">SMS</option>
              <option value="EMAIL">Email</option>
              <option value="PUSH">Push</option>
            </select>
          </div>
          <input
            placeholder="Subject (optional)"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
          <textarea
            required
            placeholder="Message"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={3}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
          <p className="text-xs text-ink-muted">
            This only logs the message here (same as every other notification in this app) — nothing is actually sent
            via WhatsApp/SMS/Email yet.
          </p>
          {formError && <p className="text-sm text-danger">{formError}</p>}
          <button
            type="submit"
            disabled={sending}
            className="rounded-lg bg-gold text-navy px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Create notification'}
          </button>
        </form>
      )}

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
              </tr>
            </thead>
            <tbody>
              {notifications.map((n, idx) => {
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

import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import type { NotificationRow, Member } from '../types';
import { useAuth } from '../context/AuthContext';

const CHANNEL_LABEL: Record<string, string> = { SMS: 'SMS', WHATSAPP: 'WhatsApp', EMAIL: 'Email', PUSH: 'Push' };
const STATUS_STYLES: Record<string, string> = {
  LOGGED: 'bg-line text-ink-muted',
  PENDING: 'bg-gold/15 text-gold-dim',
  FAILED: 'bg-danger/10 text-danger',
};

const EMPTY_FORM = { memberIds: [] as string[], allMembers: false, channel: 'WHATSAPP', subject: '', body: '' };

export default function NotificationsPage() {
  const { user } = useAuth();
  const canCreate = user?.role === 'ADMIN';

  const [notifications, setNotifications] = useState<NotificationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    client
      .get('/notifications')
      .then((res) => setNotifications(res.data.data))
      .catch((err) => setError(err?.response?.status === 403 ? "You don't have access to view notifications." : 'Could not load notifications.'));
  }

  useEffect(load, []);

  useEffect(() => {
    if (canCreate && showForm && members.length === 0) {
      (async () => {
        try {
          const first = await client.get('/members', { params: { page: 1, pageSize: 100 } });
          const firstPage = first.data;
          const totalPages = firstPage.pagination?.totalPages || 1;
          const remaining = await Promise.all(
            Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) =>
              client.get('/members', { params: { page: index + 2, pageSize: 100 } })
            )
          );
          setMembers([
            ...firstPage.data,
            ...remaining.flatMap((res) => res.data.data),
          ]);
        } catch {
          setFormError('Could not load members. Please try again.');
        }
      })();
    }
  }, [canCreate, showForm, members.length]);

  const selectedCount = form.allMembers ? members.length : form.memberIds.length;
  const selectedLabel = useMemo(() => {
    if (form.allMembers) return `All members (${members.length})`;
    if (!form.memberIds.length) return 'Select recipient(s)…';
    return `${form.memberIds.length} member${form.memberIds.length === 1 ? '' : 's'} selected`;
  }, [form.allMembers, form.memberIds.length, members.length]);

  function toggleMember(id: string) {
    setForm((current) => ({
      ...current,
      memberIds: current.memberIds.includes(id)
        ? current.memberIds.filter((memberId) => memberId !== id)
        : [...current.memberIds, id],
      allMembers: false,
    }));
  }

  function toggleAll() {
    setForm((current) => ({ ...current, allMembers: !current.allMembers, memberIds: [] }));
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.allMembers && form.memberIds.length === 0) {
      setFormError('Select at least one member or choose All members.');
      return;
    }
    setSending(true);
    try {
      await client.post('/notifications', {
        memberIds: form.allMembers ? undefined : form.memberIds,
        allMembers: form.allMembers,
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

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this notification? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await client.delete(`/notifications/${id}`);
      setNotifications((current) => current?.filter((n) => n.id !== id) ?? current);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not delete this notification.');
    } finally {
      setDeletingId(null);
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
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-ink">Recipients</label>
              <span className="text-xs text-ink-muted">{selectedCount} selected</span>
            </div>
            <div className="rounded-lg border border-line overflow-hidden">
              <label className="flex items-center gap-3 px-3 py-3 bg-paper/60 border-b border-line cursor-pointer">
                <input type="checkbox" checked={form.allMembers} onChange={toggleAll} />
                <span className="font-medium text-sm">All members</span>
                <span className="text-xs text-ink-muted">({members.length})</span>
              </label>
              <div className="max-h-56 overflow-y-auto divide-y divide-line">
                {members.map((m) => (
                  <label key={m.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${form.allMembers ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      checked={form.allMembers || form.memberIds.includes(m.id)}
                      disabled={form.allMembers}
                      onChange={() => toggleMember(m.id)}
                    />
                    <span className="text-sm">{m.name}</span>
                    <span className="text-xs text-ink-muted">{m.mobileNumber}</span>
                  </label>
                ))}
                {members.length === 0 && <p className="px-3 py-4 text-sm text-ink-muted">Loading members…</p>}
              </div>
            </div>
            <p className="mt-1 text-xs text-ink-muted">{selectedLabel}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            disabled={sending || selectedCount === 0}
            className="rounded-lg bg-gold text-navy px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {sending ? 'Creating…' : 'Create notification'}
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
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[92px]" />
              <col className="w-[18%]" />
              <col className="w-[82px]" />
              <col />
              <col className="w-[82px]" />
              {canCreate && <col className="w-[72px]" />}
            </colgroup>
            <thead className="bg-navy text-white text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Recipient</th>
                  <th className="text-left px-4 py-3">Channel</th>
                  <th className="text-left px-4 py-3">Message</th>
                  <th className="text-left px-4 py-3">Status</th>
                  {canCreate && <th className="text-right px-4 py-3">Action</th>}
                </tr>
              </thead>
              <tbody>
                {notifications.map((n, idx) => (
                  <tr key={n.id} className={`border-t border-line ${idx % 2 === 0 ? 'bg-white' : 'bg-paper/50'}`}>
                    <td className="px-4 py-3 text-ink-muted align-top whitespace-normal break-words">
                      {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 font-medium align-top whitespace-normal break-words">{n.member_name || '—'}</td>
                    <td className="px-4 py-3 align-top whitespace-normal break-words">{CHANNEL_LABEL[n.channel] || n.channel}</td>
                    <td className="px-4 py-3 align-top min-w-0 whitespace-normal break-words">
                      {n.subject && <div className="font-medium whitespace-normal break-words">{n.subject}</div>}
                      <div className="text-ink-muted whitespace-normal break-words">{n.body}</div>
                    </td>
                    <td className="px-4 py-3 align-top whitespace-normal break-words">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[n.status] || 'bg-line text-ink-muted'}`}>
                        {n.status}
                      </span>
                    </td>
                    {canCreate && (
                      <td className="px-2 py-3 text-right align-top">
                        <button
                          type="button"
                          onClick={() => handleDelete(n.id)}
                          disabled={deletingId === n.id}
                          className="rounded-md px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                        >
                          {deletingId === n.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

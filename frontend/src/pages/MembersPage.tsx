import { useEffect, useState } from 'react';
import client from '../api/client';
import type { Member } from '../types';
import { useAuth } from '../context/AuthContext';

export default function MembersPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', mobileNumber: '', email: '', aadhaarNumber: '' });
  const [error, setError] = useState<string | null>(null);
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  async function load() {
    setLoading(true);
    const res = await client.get('/members', { params: { search: search || undefined } });
    setMembers(res.data.data);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await client.post('/members', form);
      setForm({ name: '', mobileNumber: '', email: '', aadhaarNumber: '' });
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not add member.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Members</h2>
          <p className="text-ink-muted text-sm mt-1">Every JFC member, their contact details, and status.</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-navy text-white px-4 py-2 text-sm font-medium hover:bg-navy-light transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add member'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleAddMember} className="ledger-card p-5 grid grid-cols-2 gap-4">
          <input
            required
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Mobile number (10 digits)"
            value={form.mobileNumber}
            onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 text-sm"
          />
          <input
            placeholder="Email (optional)"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 text-sm"
          />
          <input
            placeholder="Aadhaar number (optional, 12 digits)"
            value={form.aadhaarNumber}
            onChange={(e) => setForm({ ...form, aadhaarNumber: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 text-sm"
          />
          {error && <p className="col-span-2 text-sm text-danger">{error}</p>}
          <button type="submit" className="col-span-2 rounded-lg bg-gold text-navy py-2 text-sm font-medium">
            Save member
          </button>
        </form>
      )}

      <input
        placeholder="Search by name or mobile number…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-line px-3 py-2 text-sm"
      />

      <div className="ledger-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper text-ink-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Mobile</th>
              <th className="text-left px-4 py-3">Aadhaar</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                  Loading…
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                  No members found.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 font-tabular">{m.mobileNumber}</td>
                  <td className="px-4 py-3 font-tabular text-ink-muted">{m.aadhaarMasked}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        m.status === 'ACTIVE'
                          ? 'bg-success/10 text-success'
                          : m.status === 'SUSPENDED'
                            ? 'bg-danger/10 text-danger'
                            : 'bg-line text-ink-muted'
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{new Date(m.joinedDate).toLocaleDateString('en-IN')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

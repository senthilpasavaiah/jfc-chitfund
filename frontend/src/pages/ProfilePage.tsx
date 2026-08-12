import { useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setSubmitting(true);
    try {
      await client.post('/auth/change-password', { currentPassword, newPassword });
      setMessage({ type: 'success', text: 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Could not change password.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <p className="text-ink-muted text-sm">Your account details and password.</p>

      <div className="ledger-card p-5 space-y-2">
        <div className="flex justify-between text-sm border-b border-line pb-2">
          <span className="text-ink-muted">Phone</span>
          <span className="font-tabular">{user?.phone}</span>
        </div>
        <div className="flex justify-between text-sm border-b border-line pb-2">
          <span className="text-ink-muted">Email</span>
          <span>{user?.email || '—'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-ink-muted">Role</span>
          <span className="font-medium text-navy">{user?.role}</span>
        </div>
      </div>

      <div className="ledger-card p-5">
        <h3 className="font-medium mb-4">Change password</h3>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            required
          />
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            required
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            required
          />
          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-success' : 'text-danger'}`}>{message.text}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-navy text-white py-2.5 text-sm font-medium hover:bg-navy-light transition-colors disabled:opacity-60"
          >
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}

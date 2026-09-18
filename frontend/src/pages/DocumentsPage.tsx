import { useEffect, useState } from 'react';
import client from '../api/client';
import type { ClubDocument } from '../types';
import { useAuth } from '../context/AuthContext';

const CATEGORY_LABEL: Record<string, string> = {
  ACCOUNTS: 'Accounts',
  REGISTRATION: 'Registration',
  BYLAWS: 'Bylaws',
  OTHER: 'Other',
};
const CATEGORY_STYLES: Record<string, string> = {
  ACCOUNTS: 'bg-navy/10 text-navy',
  REGISTRATION: 'bg-gold/15 text-gold-dim',
  BYLAWS: 'bg-[#e6f0ea] text-[#1f6b45]',
  OTHER: 'bg-line text-ink-muted',
};

const EMPTY_FORM = { title: '', category: 'OTHER', description: '' };

export default function DocumentsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN';

  const [documents, setDocuments] = useState<ClubDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<{ name: string; mimeType: string; data: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    client
      .get('/documents')
      .then((res) => setDocuments(res.data.data))
      .catch((err) => setError(err?.response?.status === 403 ? "You don't have access to view documents." : 'Could not load documents.'));
  }

  useEffect(load, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setFile(null);
      return;
    }
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
    const [meta, base64] = dataUrl.split(',');
    const mimeType = meta.match(/data:(.*);base64/)?.[1] || f.type;
    setFile({ name: f.name, mimeType, data: base64 });
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!file) {
      setFormError('Please choose a file to upload.');
      return;
    }
    setSaving(true);
    try {
      await client.post('/documents', {
        title: form.title,
        category: form.category,
        description: form.description || undefined,
        fileName: file.name,
        fileMimeType: file.mimeType,
        fileData: file.data,
      });
      setForm(EMPTY_FORM);
      setFile(null);
      setShowForm(false);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Could not upload this document.');
    } finally {
      setSaving(false);
    }
  }

  async function handleView(doc: ClubDocument) {
    setBusyId(doc.id);
    try {
      const res = await client.get(`/documents/${doc.id}/file`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: doc.file_mime_type });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch {
      window.alert('Could not open this document.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(doc: ClubDocument) {
    if (!window.confirm(`Delete "${doc.title}"? This can't be undone.`)) return;
    setBusyId(doc.id);
    try {
      await client.delete(`/documents/${doc.id}`);
      load();
    } catch (err: any) {
      window.alert(err?.response?.data?.message || 'Could not delete this document.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-ink-muted text-sm">
          Club documents kept here for future reference and verification — Accounts, Registration papers, Bylaws, and
          anything else worth keeping on record.
        </p>
        {canManage && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-navy text-white px-4 py-2 text-sm font-medium hover:bg-navy-light transition-colors cursor-pointer whitespace-nowrap"
          >
            {showForm ? 'Cancel' : '+ Upload document'}
          </button>
        )}
      </div>

      {showForm && canManage && (
        <form onSubmit={handleUpload} className="ledger-card p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              required
              placeholder="Title (e.g. FY2025-26 Audited Accounts)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="rounded-lg border border-line px-3 py-2 text-sm"
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="rounded-lg border border-line px-3 py-2 text-sm"
            >
              <option value="ACCOUNTS">Accounts</option>
              <option value="REGISTRATION">Registration</option>
              <option value="BYLAWS">Bylaws</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
          <div>
            <input
              required
              type="file"
              onChange={handleFileChange}
              className="text-sm"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            />
            <p className="text-xs text-ink-muted mt-1">PDF, image, or Office document, up to 10MB.</p>
          </div>
          {formError && <p className="text-sm text-danger">{formError}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gold text-navy px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Uploading…' : 'Upload document'}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      {!error && !documents && <p className="text-ink-muted">Loading…</p>}

      {!error && documents && documents.length === 0 && (
        <div className="ledger-card p-8 text-center">
          <p className="text-ink-muted">No documents have been uploaded yet.</p>
        </div>
      )}

      {!error && documents && documents.length > 0 && (
        <div className="ledger-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-navy text-white text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Title</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-left px-4 py-3">Uploaded by</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d, idx) => (
                  <tr key={d.id} className={`border-t border-line ${idx % 2 === 0 ? 'bg-white' : 'bg-paper/50'}`}>
                    <td className="px-4 py-3 max-w-sm">
                      <div className="font-medium">{d.title}</div>
                      {d.description && <div className="text-ink-muted text-xs truncate">{d.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_STYLES[d.category] || CATEGORY_STYLES.OTHER}`}>
                        {CATEGORY_LABEL[d.category] || d.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{d.uploaded_by_name || '—'}</td>
                    <td className="px-4 py-3 text-ink-muted whitespace-nowrap">
                      {new Date(d.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => handleView(d)}
                        disabled={busyId === d.id}
                        className="text-navy underline text-xs font-medium cursor-pointer disabled:opacity-50 mr-3"
                      >
                        View
                      </button>
                      {canManage && (
                        <button
                          onClick={() => handleDelete(d)}
                          disabled={busyId === d.id}
                          className="text-danger underline text-xs font-medium cursor-pointer disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

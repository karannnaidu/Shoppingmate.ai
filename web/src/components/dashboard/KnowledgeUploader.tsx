'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';

export type KbDoc = {
  id: string;
  filename: string;
  sizeBytes: number;
  status: 'uploaded' | 'processing' | 'ready' | 'failed';
  enabled: boolean;
  tokenCount: number;
};

export function KnowledgeUploader({ docs }: { docs: KbDoc[] }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<KbDoc | null>(null);
  const totalTokens = docs.reduce((sum, d) => sum + (d.enabled ? d.tokenCount : 0), 0);
  const overBudget = totalTokens > 8000;

  async function upload(file: File) {
    setError(null);
    if (file.size > 4 * 1024 * 1024) {
      setError('File too large — max 4 MB.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/kb/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Upload failed. Please try again.');
        return;
      }
      window.location.reload();
    } catch {
      setError('Upload failed — check your connection and try again.');
    } finally {
      setUploading(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void upload(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle>Brand Knowledge Files</CardTitle></CardHeader>
        <CardContent>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              if (!uploading) setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-colors',
              uploading
                ? 'opacity-50 border-border'
                : dragOver
                  ? 'border-violet bg-violet/5'
                  : 'border-border hover:border-border-strong hover:bg-surface-muted',
            )}
          >
            <input type="file" accept=".pdf,.docx,.md,.txt" onChange={onFile} disabled={uploading} className="hidden" />
            <p className="text-sm font-medium text-text-primary">
              {uploading ? 'Uploading…' : dragOver ? 'Drop to upload' : 'Drag and drop or click to upload'}
            </p>
            <p className="text-xs text-text-secondary mt-1">PDF, .docx, .md, .txt — up to 4 MB</p>
          </label>
          {error && (
            <p className="text-sm text-rose-500 mt-3" role="alert" aria-live="polite">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
      <div className={cn('text-sm rounded-md border p-3 tabular-nums', overBudget ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-surface-muted border-border text-text-secondary')}>
        <span>
          <span className={cn('font-semibold', overBudget ? 'text-amber-500' : 'text-text-primary')}>{`Total: ${totalTokens.toLocaleString()} / 8,000 tokens`}</span>
          {' — '}
          {overBudget ? 'exceeds 8K budget; switching to top-K embedding retrieval.' : 'full KB injected at session start.'}
        </span>
      </div>
      {docs.length > 0 && (
        <Card>
          <CardContent className="px-0">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-text-muted tracking-wide">
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left font-medium">Filename</th>
                  <th className="text-left font-medium">Size</th>
                  <th className="text-left font-medium">Status</th>
                  <th className="text-left font-medium">Tokens</th>
                  <th className="text-left font-medium">Enabled</th>
                  <th className="px-6 text-right font-medium">Edit</th>
                </tr>
              </thead>
              <tbody className="text-text-primary">
                {docs.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0 hover:bg-surface-muted transition-colors">
                    <td className="px-6 py-3">{d.filename}</td>
                    <td className="tabular-nums text-text-secondary">{(d.sizeBytes / 1024).toFixed(0)} KB</td>
                    <td className="text-text-secondary">{d.status}</td>
                    <td className="tabular-nums text-text-secondary">{d.tokenCount}</td>
                    <td>{d.enabled ? <span className="text-emerald-500">✓</span> : <span className="text-text-muted">—</span>}</td>
                    <td className="px-6 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(d)}
                        className="text-violet hover:underline underline-offset-4"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      {editing && <DocEditor doc={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// Edit a document's extracted text and re-train on Save. Loads the current text,
// POSTs the edit, and reloads once the re-ingest is queued.
function DocEditor({ doc, onClose }: { doc: KbDoc; onClose: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch(`/api/kb/${doc.id}/text`);
        const j = await r.json();
        if (active) setText(typeof j.text === 'string' ? j.text : '');
      } catch {
        if (active) setText('');
      }
    })();
    return () => {
      active = false;
    };
  }, [doc.id]);

  async function save() {
    if (text == null) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/kb/${doc.id}/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const j = await res.json().catch(() => ({}));
      setError(typeof j.error === 'string' ? j.error : 'Save failed.');
      setSaving(false);
    } catch {
      setError('Save failed — please try again.');
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-border bg-surface p-5 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Edit — {doc.filename}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text-primary">
            ×
          </button>
        </div>
        <p className="text-xs text-text-secondary">
          Fix any mistakes below. Saving re-trains the assistant on this content within seconds.
        </p>
        {text == null ? (
          <p className="text-sm text-text-muted py-10 text-center">Loading…</p>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={16}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary font-mono resize-y focus:outline-none focus:border-violet focus:ring-2 focus:ring-violet/30"
          />
        )}
        {error && (
          <p className="text-sm text-rose-500" role="alert" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || text == null}>
            {saving ? 'Saving…' : 'Save & re-train'}
          </Button>
        </div>
      </div>
    </div>
  );
}

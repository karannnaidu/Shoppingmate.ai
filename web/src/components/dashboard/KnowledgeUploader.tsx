'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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

function Spinner() {
  return (
    <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// Edit a document's extracted text and re-train on save. Loads the current text,
// tracks unsaved changes, supports keyboard shortcuts (Esc / Cmd-Ctrl+Enter),
// and re-ingests on save.
function DocEditor({ doc, onClose }: { doc: KbDoc; onClose: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const [initial, setInitial] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loaded = text != null;
  const dirty = loaded && text !== initial;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch(`/api/kb/${doc.id}/text`);
        const j = await r.json();
        const t = typeof j.text === 'string' ? j.text : '';
        if (active) {
          setText(t);
          setInitial(t);
        }
      } catch {
        if (active) {
          setText('');
          setInitial('');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [doc.id]);

  // Focus the editor once the text has loaded.
  useEffect(() => {
    if (loaded) textareaRef.current?.focus();
  }, [loaded]);

  const attemptClose = useCallback(() => {
    if (saving) return;
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    onClose();
  }, [dirty, saving, onClose]);

  const save = useCallback(async () => {
    if (text == null || !dirty) return;
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
  }, [text, dirty, doc.id]);

  // Keyboard: Esc closes (with unsaved guard), Cmd/Ctrl+Enter saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        attemptClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attemptClose, save]);

  const chars = text?.length ?? 0;
  const words = text ? (text.trim().match(/\S+/g)?.length ?? 0) : 0;
  const approxTokens = Math.ceil(chars / 4);
  const overBudget = approxTokens > 8000;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={attemptClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kb-editor-title"
    >
      <div
        className="flex w-full max-w-3xl max-h-[85vh] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h3 id="kb-editor-title" className="text-sm font-semibold text-text-primary">
              Edit knowledge
            </h3>
            <p className="truncate text-xs text-text-secondary" title={doc.filename}>
              {doc.filename}
            </p>
          </div>
          <button
            type="button"
            onClick={attemptClose}
            aria-label="Close editor"
            className="-mr-1 -mt-1 rounded-md p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-violet/40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Helper */}
        <div className="border-b border-border bg-surface-muted/40 px-5 py-2.5">
          <p className="text-xs text-text-secondary">
            This is the text the assistant learns from. Fix anything wrong —{' '}
            <span className="font-medium text-text-primary">Save re-trains within seconds.</span>
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {text == null ? (
            <div className="space-y-2.5" aria-hidden="true">
              {[92, 78, 88, 64, 84, 72].map((w, i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-surface-muted" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck
              placeholder="This document has no text yet — paste or type the knowledge the assistant should learn."
              className="min-h-[45vh] w-full resize-y rounded-lg border border-border bg-background px-4 py-3 text-sm leading-relaxed text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet focus:ring-2 focus:ring-violet/30"
            />
          )}
          {error && (
            <p className="mt-3 text-sm text-rose-500" role="alert" aria-live="polite">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <div className="flex items-center gap-2.5 text-xs tabular-nums text-text-muted">
            <span>{words.toLocaleString()} words</span>
            <span aria-hidden="true">·</span>
            <span className={overBudget ? 'text-amber-500' : undefined}>
              ~{approxTokens.toLocaleString()} tokens
            </span>
            {dirty && <span className="text-amber-500">· Unsaved changes</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] text-text-muted sm:inline">⌘/Ctrl + Enter to save</span>
            <Button variant="outline" onClick={attemptClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !dirty || text == null}>
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Re-training…
                </span>
              ) : (
                'Save & re-train'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
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
  const totalTokens = docs.reduce((sum, d) => sum + (d.enabled ? d.tokenCount : 0), 0);
  const overBudget = totalTokens > 8000;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const init = await fetch('/api/kb/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: file.name, mimeType: file.type, sizeBytes: file.size }),
    });
    const { upload_url } = await init.json();
    if (upload_url) {
      await fetch(upload_url, { method: 'PUT', body: file, headers: { 'content-type': file.type } });
      window.location.reload();
    }
    setUploading(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle>Brand Knowledge Files</CardTitle></CardHeader>
        <CardContent>
          <label className={cn('flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-10 cursor-pointer transition-colors', uploading ? 'opacity-50' : 'hover:border-border-strong hover:bg-surface-muted')}>
            <input type="file" accept=".pdf,.docx,.md,.txt" onChange={onFile} className="hidden" />
            <p className="text-sm font-medium text-text-primary">{uploading ? 'Uploading…' : 'Drag and drop or click to upload'}</p>
            <p className="text-xs text-text-secondary mt-1">PDF, .docx, .md, .txt — up to 10 MB</p>
          </label>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

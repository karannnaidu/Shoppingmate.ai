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
          <label className={cn('flex flex-col items-center justify-center border-2 border-dashed rounded-md p-8 cursor-pointer', uploading ? 'opacity-50' : 'hover:bg-zinc-50')}>
            <input type="file" accept=".pdf,.docx,.md,.txt" onChange={onFile} className="hidden" />
            <p className="text-sm">{uploading ? 'Uploading…' : 'Drag and drop or click to upload'}</p>
            <p className="text-xs text-zinc-500 mt-1">PDF, .docx, .md, .txt — up to 10 MB</p>
          </label>
        </CardContent>
      </Card>
      <div className={cn('text-sm rounded-md p-3', overBudget ? 'bg-amber-50 text-amber-900' : 'bg-zinc-50 text-zinc-700')}>
        <span>
          {`Total: ${totalTokens.toLocaleString()} / 8,000 tokens — `}
          {overBudget ? 'exceeds 8K budget; switching to top-K embedding retrieval.' : 'full KB injected at session start.'}
        </span>
      </div>
      {docs.length > 0 && (
        <Card>
          <CardContent className="px-0">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr className="border-b">
                  <th className="px-6 py-2 text-left">Filename</th>
                  <th className="text-left">Size</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Tokens</th>
                  <th className="text-left">Enabled</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="px-6 py-2">{d.filename}</td>
                    <td>{(d.sizeBytes / 1024).toFixed(0)} KB</td>
                    <td>{d.status}</td>
                    <td>{d.tokenCount}</td>
                    <td>{d.enabled ? '✓' : '—'}</td>
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

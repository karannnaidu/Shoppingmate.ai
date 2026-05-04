import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { KnowledgeUploader } from './KnowledgeUploader';

afterEach(cleanup);

describe('KnowledgeUploader', () => {
  it('renders drop zone with allowed types text', () => {
    render(<KnowledgeUploader docs={[]} />);
    expect(screen.getByText(/drag.*drop|upload/i)).toBeTruthy();
    expect(screen.getByText(/PDF.*docx.*md.*txt/i)).toBeTruthy();
  });

  it('renders file table when docs are present', () => {
    render(
      <KnowledgeUploader
        docs={[{ id: 'd1', filename: 'a.pdf', sizeBytes: 1024, status: 'ready', enabled: true, tokenCount: 200 }]}
      />,
    );
    expect(screen.getByText('a.pdf')).toBeTruthy();
    expect(screen.getByText('ready')).toBeTruthy();
  });

  it('renders token-budget meter', () => {
    render(
      <KnowledgeUploader
        docs={[{ id: 'd1', filename: 'a.pdf', sizeBytes: 1024, status: 'ready', enabled: true, tokenCount: 200 }]}
      />,
    );
    expect(screen.getByText(/200.*8,?000/)).toBeTruthy();
  });
});

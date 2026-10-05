import { describe, expect, it } from 'vitest';
import { renderLiteMarkdown } from './transcript.js';

describe('renderLiteMarkdown()', () => {
  it('renders bold and line breaks instead of raw asterisks', () => {
    expect(renderLiteMarkdown('The **Pack of 3** is best\n- one\n- two')).toBe(
      'The <strong>Pack of 3</strong> is best<br>• one<br>• two',
    );
  });

  it('escapes HTML before formatting (no injection)', () => {
    const out = renderLiteMarkdown('**<img src=x onerror=alert(1)>** & <script>');
    expect(out).toBe('<strong>&lt;img src=x onerror=alert(1)&gt;</strong> &amp; &lt;script&gt;');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('<script');
  });

  it('drops heading hashes and single-asterisk emphasis markers', () => {
    expect(renderLiteMarkdown('## Options\nthis is *great*')).toBe('Options<br>this is great');
  });
});

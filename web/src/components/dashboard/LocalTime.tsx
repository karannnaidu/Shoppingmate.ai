'use client';
import { useEffect, useState } from 'react';

// Server components render in the server's timezone (UTC), which showed owners
// in India a 9:18 pm call as "3:48 pm". This re-formats in the viewer's own
// timezone after mount; the server text is only a brief placeholder.
export function LocalTime({
  iso,
  options,
}: {
  iso: string;
  options?: Intl.DateTimeFormatOptions;
}) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    setText(new Date(iso).toLocaleString(undefined, options));
  }, [iso, options]);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text ?? new Date(iso).toLocaleString('en-GB', { ...options, timeZone: 'UTC' })}
    </time>
  );
}

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PersonaForm } from './PersonaForm';

afterEach(cleanup);

describe('PersonaForm', () => {
  it('renders voice descriptor dropdown with 8 options', () => {
    render(<PersonaForm initial={null} />);
    const select = screen.getByLabelText(/voice descriptor/i) as HTMLSelectElement;
    expect(select.options.length).toBe(8);
  });

  it('renders brand voice notes textarea with 500 char limit', () => {
    render(<PersonaForm initial={null} />);
    const textarea = screen.getByLabelText(/brand voice notes/i) as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(500);
  });

  it('renders 5-point tone slider', () => {
    render(<PersonaForm initial={null} />);
    const slider = screen.getByLabelText(/tone/i) as HTMLInputElement;
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('5');
  });
});

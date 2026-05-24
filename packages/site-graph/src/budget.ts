import { encode } from 'gpt-tokenizer';

export const TOKEN_BUDGET = 2000;

export function countTokens(text: string): number {
  return encode(text).length;
}

export function fitsBudget(text: string, budget = TOKEN_BUDGET): boolean {
  return countTokens(text) <= budget;
}

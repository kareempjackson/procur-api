import { randomUUID } from 'crypto';

/**
 * Generate a new UUID using Node.js built-in crypto module
 */
export function newId(): string {
  return randomUUID();
}

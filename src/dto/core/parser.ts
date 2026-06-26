/**
 * dto/core/parser.ts — Shared coercion helpers
 * ──────────────────────────────────────────────
 * Written once. Used by every DTO file (purchase, sale, client, supplier, etc.)
 *
 * WHY THIS EXISTS:
 *   Without this file, every xxx.dto.ts would copy-paste the same 8 helper functions.
 *   With this file, each DTO just imports what it needs and focuses only on its own
 *   interfaces and parsing logic.
 *
 * USAGE in any DTO file:
 *   import { toInt, toFloat, toDate, toStr, optInt, optFloat, optDate, optStr, assertObject }
 *     from './core/parser';
 */

import { ValidationError } from '../../core/AppError';

// ─── Body guard ───────────────────────────────────────────────────────────────

/**
 * assertObject — verifies req.body is a plain object before parsing begins.
 * Throws ValidationError (→ HTTP 400) if body is null, array, or primitive.
 */
export function assertObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

/**
 * assertArrayItem — verifies an array element is a plain object.
 * Used when parsing items[] or associatedInvoices[].
 */
export function assertArrayItem(raw: unknown, label: string): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ValidationError(`${label} must be an object.`);
  }
  return raw as Record<string, unknown>;
}

// ─── Required coercions ───────────────────────────────────────────────────────

/**
 * toInt — coerces to a positive integer.
 * Default min = 1 (suitable for all DB IDs).
 */
export function toInt(v: unknown, field: string, min = 1): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) {
    throw new ValidationError(`${field} must be an integer >= ${min}. Received: ${v}`);
  }
  return n;
}

/**
 * toFloat — coerces to a finite positive number.
 * Default min = 0.01 (suitable for monetary amounts).
 */
export function toFloat(v: unknown, field: string, min = 0.01): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) {
    throw new ValidationError(`${field} must be a number >= ${min}. Received: ${v}`);
  }
  return n;
}

/**
 * toDate — coerces to a valid Date object.
 * Accepts ISO strings, timestamps, and Date objects.
 */
export function toDate(v: unknown, field: string): Date {
  const d = new Date(v as any);
  if (isNaN(d.getTime())) {
    throw new ValidationError(`${field} must be a valid date. Received: ${v}`);
  }
  return d;
}

/**
 * toStr — coerces to a trimmed, length-checked, HTML-safe string.
 * Strips < > { } which have no place in business data.
 */
export function toStr(v: unknown, field: string, maxLen: number): string {
  if (typeof v !== 'string' && typeof v !== 'number') {
    throw new ValidationError(`${field} must be a string. Received: ${typeof v}`);
  }
  const s = String(v).trim().replace(/[<>{}]/g, '');
  if (s.length > maxLen) {
    throw new ValidationError(`${field} must not exceed ${maxLen} characters.`);
  }
  return s;
}

// ─── Optional coercions — return undefined when field is absent ───────────────

/** optInt — positive integer or undefined */
export function optInt(v: unknown, field: string, min = 1): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  return toInt(v, field, min);
}

/** optFloat — positive number or undefined */
export function optFloat(v: unknown, field: string, min = 0.01): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  return toFloat(v, field, min);
}

/** optDate — valid Date or undefined */
export function optDate(v: unknown, field: string): Date | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  return toDate(v, field);
}

/** optStr — trimmed string or undefined */
export function optStr(v: unknown, field: string, maxLen: number): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  return toStr(v, field, maxLen);
}

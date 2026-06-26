/**
 * DtoParser — Reusable HTTP boundary sanitiser
 * ──────────────────────────────────────────────
 * PROBLEM:
 *   req.body is `any`. Without sanitisation:
 *   - Unknown fields reach the service (prototype pollution, extra DB columns)
 *   - Types are wrong: "100" instead of 100, "2026-01-01" instead of Date
 *   - No predictable shape — service must defend itself everywhere
 *
 * SOLUTION (one utility, used by all controllers):
 *   1. Whitelist  — only declared fields pass through, unknown fields dropped
 *   2. Coerce     — string → number, string → Date, guaranteed correct types
 *   3. Validate   — reject obviously invalid values at the boundary
 *   4. Return     — typed, immutable DTO the service can fully trust
 *
 * DESIGN PRINCIPLE:
 *   Each entity defines a FieldSchema (10-20 lines).
 *   DtoParser does the heavy lifting (whitelist + coerce).
 *   No 250-line file per entity. One utility, 28 controllers.
 *
 * USAGE:
 *   import { DtoParser, f } from '../dto/DtoParser';
 *
 *   const SALE_SCHEMA = {
 *     clientId:    f.int(),
 *     total:       f.float(),
 *     date:        f.date(),
 *     paymentType: f.str(50),
 *     ncf:         f.str(50, { optional: true }),
 *     items:       f.array(ITEM_SCHEMA),
 *   };
 *
 *   // In controller:
 *   const dto = DtoParser.parse(req.body, SALE_SCHEMA);
 *   const result = await saleService.createSale(dto);
 */

import { ValidationError } from '../core/AppError';

// ─── Field descriptor types ───────────────────────────────────────────────────

/** Options shared by all field types */
interface FieldOptions {
  /** If true, undefined/null/'' passes through as undefined rather than throwing */
  optional?: boolean;
}

interface IntField    extends FieldOptions { _type: 'int';    min?: number; max?: number; }
interface FloatField  extends FieldOptions { _type: 'float';  min?: number; max?: number; }
interface StrField    extends FieldOptions { _type: 'str';    maxLength: number; }
interface DateField   extends FieldOptions { _type: 'date'; }
interface BoolField   extends FieldOptions { _type: 'bool'; }
interface ArrayField  extends FieldOptions { _type: 'array';  itemSchema: FieldSchema; }
interface EnumField   extends FieldOptions { _type: 'enum';   values: readonly string[]; }

export type FieldDescriptor =
  | IntField | FloatField | StrField | DateField | BoolField | ArrayField | EnumField;

/** A schema is a plain object mapping field names to descriptors */
export type FieldSchema = Record<string, FieldDescriptor>;

// ─── Field builder shortcuts (f.int(), f.str(), etc.) ────────────────────────

/**
 * Field descriptor builders — use these to define schemas concisely.
 *
 * f.int()          → positive integer, required
 * f.int({ optional: true }) → positive integer or undefined
 * f.str(100)       → string max 100 chars, required
 * f.float()        → positive decimal, required
 * f.date()         → valid Date, required
 * f.bool()         → boolean, required
 * f.enum(['A','B']) → one of the allowed values
 * f.array(schema)  → array of objects matching schema
 */
export const f = {
  int(opts: Omit<IntField, '_type'> = {}): IntField {
    return { _type: 'int', min: opts.min ?? 1, ...opts };
  },
  float(opts: Omit<FloatField, '_type'> = {}): FloatField {
    return { _type: 'float', min: opts.min ?? 0.01, ...opts };
  },
  str(maxLength: number, opts: Omit<StrField, '_type' | 'maxLength'> = {}): StrField {
    return { _type: 'str', maxLength, ...opts };
  },
  date(opts: Omit<DateField, '_type'> = {}): DateField {
    return { _type: 'date', ...opts };
  },
  bool(opts: Omit<BoolField, '_type'> = {}): BoolField {
    return { _type: 'bool', ...opts };
  },
  array(itemSchema: FieldSchema, opts: Omit<ArrayField, '_type' | 'itemSchema'> = {}): ArrayField {
    return { _type: 'array', itemSchema, ...opts };
  },
  enum<T extends string>(values: readonly T[], opts: Omit<EnumField, '_type' | 'values'> = {}): EnumField {
    return { _type: 'enum', values, ...opts };
  },
};

// ─── Core parser ──────────────────────────────────────────────────────────────

export class DtoParser {

  /**
   * parse — The single entry point.
   *
   * Takes raw req.body + a field schema and returns a sanitised, typed object.
   * Fields not in the schema are silently dropped.
   * Fields in the schema are coerced to their declared type.
   * Throws ValidationError if any required field is missing or has invalid type.
   *
   * @param body   raw req.body (any)
   * @param schema FieldSchema — map of allowed fields and their types
   * @returns      Sanitised plain object matching the schema
   */
  static parse<T extends FieldSchema>(
    body: unknown,
    schema: T
  ): ParsedDto<T> {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new ValidationError('Request body must be a JSON object.');
    }

    const raw = body as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [field, descriptor] of Object.entries(schema)) {
      const value = raw[field];
      const isAbsent = value === undefined || value === null || value === '';

      if (isAbsent) {
        if (descriptor.optional) {
          result[field] = undefined;
          continue;
        } else {
          throw new ValidationError(`${field} is required.`);
        }
      }

      result[field] = DtoParser.coerce(value, descriptor, field);
    }

    // Freeze: prevents service from accidentally mutating the DTO
    return Object.freeze(result) as ParsedDto<T>;
  }

  // ─── Private coercion dispatch ────────────────────────────────────────────

  private static coerce(value: unknown, desc: FieldDescriptor, field: string): unknown {
    switch (desc._type) {
      case 'int':   return DtoParser.coerceInt(value, field, desc);
      case 'float': return DtoParser.coerceFloat(value, field, desc);
      case 'str':   return DtoParser.coerceStr(value, field, desc);
      case 'date':  return DtoParser.coerceDate(value, field);
      case 'bool':  return DtoParser.coerceBool(value, field);
      case 'array': return DtoParser.coerceArray(value, field, desc);
      case 'enum':  return DtoParser.coerceEnum(value, field, desc);
    }
  }

  private static coerceInt(value: unknown, field: string, desc: IntField): number {
    const n = Number(value);
    if (!Number.isInteger(n)) {
      throw new ValidationError(`${field} must be a whole number. Received: ${value}`);
    }
    if (desc.min !== undefined && n < desc.min) {
      throw new ValidationError(`${field} must be at least ${desc.min}. Received: ${n}`);
    }
    if (desc.max !== undefined && n > desc.max) {
      throw new ValidationError(`${field} must be at most ${desc.max}. Received: ${n}`);
    }
    return n;
  }

  private static coerceFloat(value: unknown, field: string, desc: FloatField): number {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      throw new ValidationError(`${field} must be a number. Received: ${value}`);
    }
    if (desc.min !== undefined && n < desc.min) {
      throw new ValidationError(`${field} must be at least ${desc.min}. Received: ${n}`);
    }
    if (desc.max !== undefined && n > desc.max) {
      throw new ValidationError(`${field} must be at most ${desc.max}. Received: ${n}`);
    }
    return n;
  }

  private static coerceStr(value: unknown, field: string, desc: StrField): string {
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new ValidationError(`${field} must be a string. Received: ${typeof value}`);
    }
    const str = String(value).trim();
    if (str.length > desc.maxLength) {
      throw new ValidationError(`${field} must not exceed ${desc.maxLength} characters.`);
    }
    // Strip HTML-dangerous characters — no business field needs these
    return str.replace(/[<>{}]/g, '');
  }

  private static coerceDate(value: unknown, field: string): Date {
    const d = new Date(value as any);
    if (isNaN(d.getTime())) {
      throw new ValidationError(`${field} must be a valid date. Received: ${value}`);
    }
    return d;
  }

  private static coerceBool(value: unknown, field: string): boolean {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1' || value === 1) return true;
    if (value === 'false' || value === '0' || value === 0) return false;
    throw new ValidationError(`${field} must be a boolean. Received: ${value}`);
  }

  private static coerceArray(value: unknown, field: string, desc: ArrayField): unknown[] {
    if (!Array.isArray(value)) {
      throw new ValidationError(`${field} must be an array. Received: ${typeof value}`);
    }
    return value.map((item, i) =>
      DtoParser.parse(item, desc.itemSchema)
    );
  }

  private static coerceEnum(value: unknown, field: string, desc: EnumField): string {
    const str = String(value).trim();
    if (!desc.values.includes(str)) {
      throw new ValidationError(
        `${field} must be one of: ${desc.values.join(', ')}. Received: ${str}`
      );
    }
    return str;
  }
}

// ─── Type inference ───────────────────────────────────────────────────────────
// Automatically infers the return type of DtoParser.parse() from the schema.
// You never have to manually write the return interface.

type InferField<F extends FieldDescriptor> =
  F extends IntField    ? number :
  F extends FloatField  ? number :
  F extends StrField    ? string :
  F extends DateField   ? Date :
  F extends BoolField   ? boolean :
  F extends ArrayField  ? ParsedDto<F['itemSchema']>[] :
  F extends EnumField   ? string :
  never;

type InferOptional<F extends FieldDescriptor> =
  F extends { optional: true } ? InferField<F> | undefined : InferField<F>;

export type ParsedDto<S extends FieldSchema> = {
  readonly [K in keyof S]: InferOptional<S[K]>;
};

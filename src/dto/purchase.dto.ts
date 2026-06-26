/**
 * purchase.dto.ts — Purchase Data Transfer Object
 * ──────────────────────────────────────────────────
 * Interfaces live here (purchase-specific types stay in this file).
 * Coercion helpers are imported from dto/core/parser.ts (shared with all DTOs).
 *
 * Controller usage:
 *   const dto = parsePurchaseDTO(req.body);
 *   const result = await purchaseService.createPurchase(dto);
 */

import { ValidationError } from '../core/AppError';
import {
  assertObject, assertArrayItem,
  toInt, toFloat, toDate, toStr,
  optInt, optFloat, optDate, optStr,
} from './core/parser';

// ─── Interfaces (purchase-specific — stay in this file) ──────────────────────

export interface PurchaseItemDTO {
  readonly productId:          number;
  readonly quantity:           number;
  readonly unitCost:           number;
  readonly unitOfMeasurement?: string;
  readonly tax?:               number;
  readonly subtotal?:          number;
  readonly total?:             number;
}

export interface AssociatedInvoiceDTO {
  readonly supplierRnc?:       string;
  readonly supplierName?:      string;
  readonly concept?:           string;
  readonly ncf?:               string;
  readonly date?:              Date;
  readonly tax?:               number;
  readonly taxAmount?:         number;
  readonly amount?:            number;
  readonly purchaseType?:      string;
  readonly paymentType?:       string;
  readonly cardId?:            number;
  readonly bankAccountId?:     number;
  readonly chequeNumber?:      string;
  readonly chequeDate?:        Date;
  readonly transferNumber?:    string;
  readonly transferDate?:      Date;
  readonly paymentReference?:  string;
  readonly voucherDate?:       Date;
}

export interface CreatePurchaseDTO {
  readonly supplierId:          number;
  readonly total:               number;
  readonly date:                Date;
  readonly purchaseType:        string;
  readonly paymentType:         string;
  readonly supplierRnc?:        string;
  readonly ncf?:                string;
  readonly productTotal?:       number;
  readonly bankAccountId?:      number;
  readonly cardId?:             number;
  readonly chequeNumber?:       string;
  readonly chequeDate?:         Date;
  readonly transferNumber?:     string;
  readonly transferDate?:       Date;
  readonly paymentReference?:   string;
  readonly voucherDate?:        Date;
  readonly items?:              PurchaseItemDTO[];
  readonly associatedInvoices?: AssociatedInvoiceDTO[];
}

// ─── Sub-parsers ──────────────────────────────────────────────────────────────

function parseItem(raw: unknown, idx: number): PurchaseItemDTO {
  const r = assertArrayItem(raw, `Item ${idx + 1}`);
  return Object.freeze<PurchaseItemDTO>({
    productId:         toInt  (r.productId,          `Item ${idx + 1} productId`),
    quantity:          toFloat(r.quantity,            `Item ${idx + 1} quantity`,           0.001),
    unitCost:          toFloat(r.unitCost,            `Item ${idx + 1} unitCost`,            0.01),
    unitOfMeasurement: optStr (r.unitOfMeasurement,  `Item ${idx + 1} unitOfMeasurement`,    50),
    tax:               optFloat(r.tax,               `Item ${idx + 1} tax`,                  0),
    subtotal:          optFloat(r.subtotal,           `Item ${idx + 1} subtotal`,             0),
    total:             optFloat(r.total,              `Item ${idx + 1} total`,                0),
  });
}

function parseInvoice(raw: unknown, idx: number): AssociatedInvoiceDTO {
  const r = assertArrayItem(raw, `Invoice ${idx + 1}`);
  return Object.freeze<AssociatedInvoiceDTO>({
    supplierRnc:      optStr  (r.supplierRnc,      `Invoice ${idx + 1} supplierRnc`,       50),
    supplierName:     optStr  (r.supplierName,     `Invoice ${idx + 1} supplierName`,      255),
    concept:          optStr  (r.concept,          `Invoice ${idx + 1} concept`,           255),
    ncf:              optStr  (r.ncf,              `Invoice ${idx + 1} ncf`,                50),
    date:             optDate (r.date,             `Invoice ${idx + 1} date`),
    tax:              optFloat(r.tax,              `Invoice ${idx + 1} tax`,                 0),
    taxAmount:        optFloat(r.taxAmount,        `Invoice ${idx + 1} taxAmount`,           0),
    amount:           optFloat(r.amount,           `Invoice ${idx + 1} amount`,           0.01),
    purchaseType:     optStr  (r.purchaseType,     `Invoice ${idx + 1} purchaseType`,      100),
    paymentType:      optStr  (r.paymentType,      `Invoice ${idx + 1} paymentType`,        50),
    cardId:           optInt  (r.cardId,           `Invoice ${idx + 1} cardId`),
    bankAccountId:    optInt  (r.bankAccountId,    `Invoice ${idx + 1} bankAccountId`),
    chequeNumber:     optStr  (r.chequeNumber,     `Invoice ${idx + 1} chequeNumber`,      100),
    chequeDate:       optDate (r.chequeDate,       `Invoice ${idx + 1} chequeDate`),
    transferNumber:   optStr  (r.transferNumber,   `Invoice ${idx + 1} transferNumber`,    100),
    transferDate:     optDate (r.transferDate,     `Invoice ${idx + 1} transferDate`),
    paymentReference: optStr  (r.paymentReference, `Invoice ${idx + 1} paymentReference`,  100),
    voucherDate:      optDate (r.voucherDate,      `Invoice ${idx + 1} voucherDate`),
  });
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parsePurchaseDTO(body: unknown): CreatePurchaseDTO {
  const raw = assertObject(body);

  return Object.freeze<CreatePurchaseDTO>({
    supplierId:          toInt  (raw.supplierId,       'supplierId'),
    total:               toFloat(raw.total,            'total'),
    date:                toDate (raw.date,             'date'),
    purchaseType:        toStr  (raw.purchaseType,     'purchaseType',     100),
    paymentType:         toStr  (raw.paymentType,      'paymentType',       50),
    supplierRnc:         optStr (raw.supplierRnc,      'supplierRnc',       50),
    ncf:                 optStr (raw.ncf,              'ncf',               50),
    productTotal:        optFloat(raw.productTotal,    'productTotal'),
    bankAccountId:       optInt (raw.bankAccountId,    'bankAccountId'),
    cardId:              optInt (raw.cardId,           'cardId'),
    chequeNumber:        optStr (raw.chequeNumber,     'chequeNumber',      100),
    chequeDate:          optDate(raw.chequeDate,       'chequeDate'),
    transferNumber:      optStr (raw.transferNumber,   'transferNumber',    100),
    transferDate:        optDate(raw.transferDate,     'transferDate'),
    paymentReference:    optStr (raw.paymentReference, 'paymentReference',  100),
    voucherDate:         optDate(raw.voucherDate,      'voucherDate'),
    items:               Array.isArray(raw.items)
                           ? raw.items.map((x, i) => parseItem(x, i))
                           : undefined,
    associatedInvoices:  Array.isArray(raw.associatedInvoices)
                           ? raw.associatedInvoices.map((x, i) => parseInvoice(x, i))
                           : undefined,
  });
}

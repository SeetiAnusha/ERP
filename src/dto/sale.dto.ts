/**
 * sale.dto.ts — Sale Data Transfer Object
 * ──────────────────────────────────────────
 * Interfaces live here (sale-specific types stay in this file).
 * Coercion helpers are imported from dto/core/parser.ts (shared with all DTOs).
 *
 * Controller usage:
 *   const dto = parseSaleDTO(req.body);
 *   const result = await saleService.createSale(dto);
 */

import {
  assertObject, assertArrayItem,
  toInt, toFloat, toDate, toStr,
  optInt, optFloat, optDate, optStr,
} from './core/parser';

// ─── Interfaces (sale-specific — stay in this file) ──────────────────────────

export interface SaleItemDTO {
  readonly productId:          number;
  readonly quantity:           number;
  readonly unitPrice:          number;
  readonly unitOfMeasurement?: string;
  readonly tax?:               number;
  readonly subtotal?:          number;
  readonly total?:             number;
  readonly discount?:          number;
}

export interface CreateSaleDTO {
  readonly date:                 Date;
  readonly paymentType:          string;
  readonly total:                number;
  readonly clientId?:            number;
  readonly clientRnc?:           string;
  readonly ncf?:                 string;
  readonly subtotal?:            number;
  readonly tax?:                 number;
  readonly discount?:            number;
  readonly cashRegisterId?:      number;
  readonly bankAccountId?:       number;
  readonly cardId?:              number;
  readonly cardPaymentNetworkId?: number;
  readonly chequeNumber?:        string;
  readonly chequeDate?:          Date;
  readonly transferNumber?:      string;
  readonly transferDate?:        Date;
  readonly paymentReference?:    string;
  readonly voucherDate?:         Date;
  readonly items?:               SaleItemDTO[];
}

// ─── Sub-parser ───────────────────────────────────────────────────────────────

function parseSaleItem(raw: unknown, idx: number): SaleItemDTO {
  const r = assertArrayItem(raw, `Sale item ${idx + 1}`);
  return Object.freeze<SaleItemDTO>({
    productId:         toInt  (r.productId,         `Sale item ${idx + 1} productId`),
    quantity:          toFloat(r.quantity,           `Sale item ${idx + 1} quantity`,        0.001),
    unitPrice:         toFloat(r.unitPrice,          `Sale item ${idx + 1} unitPrice`,       0.01),
    unitOfMeasurement: optStr (r.unitOfMeasurement,  `Sale item ${idx + 1} unitOfMeasurement`, 50),
    tax:               optFloat(r.tax,               `Sale item ${idx + 1} tax`,               0),
    subtotal:          optFloat(r.subtotal,           `Sale item ${idx + 1} subtotal`,          0),
    total:             optFloat(r.total,              `Sale item ${idx + 1} total`,             0),
    discount:          optFloat(r.discount,           `Sale item ${idx + 1} discount`,          0),
  });
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseSaleDTO(body: unknown): CreateSaleDTO {
  const raw = assertObject(body);

  return Object.freeze<CreateSaleDTO>({
    date:                 toDate (raw.date,                 'date'),
    paymentType:          toStr  (raw.paymentType,          'paymentType',           50),
    total:                toFloat(raw.total,                'total'),
    clientId:             optInt (raw.clientId,             'clientId'),
    clientRnc:            optStr (raw.clientRnc,            'clientRnc',             50),
    ncf:                  optStr (raw.ncf,                  'ncf',                   50),
    subtotal:             optFloat(raw.subtotal,            'subtotal',               0),
    tax:                  optFloat(raw.tax,                 'tax',                    0),
    discount:             optFloat(raw.discount,            'discount',               0),
    cashRegisterId:       optInt (raw.cashRegisterId,       'cashRegisterId'),
    bankAccountId:        optInt (raw.bankAccountId,        'bankAccountId'),
    cardId:               optInt (raw.cardId,               'cardId'),
    cardPaymentNetworkId: optInt (raw.cardPaymentNetworkId, 'cardPaymentNetworkId'),
    chequeNumber:         optStr (raw.chequeNumber,         'chequeNumber',          100),
    chequeDate:           optDate(raw.chequeDate,           'chequeDate'),
    transferNumber:       optStr (raw.transferNumber,       'transferNumber',        100),
    transferDate:         optDate(raw.transferDate,         'transferDate'),
    paymentReference:     optStr (raw.paymentReference,     'paymentReference',      100),
    voucherDate:          optDate(raw.voucherDate,          'voucherDate'),
    items:                Array.isArray(raw.items)
                            ? raw.items.map((x, i) => parseSaleItem(x, i))
                            : undefined,
  });
}

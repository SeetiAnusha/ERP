# Double-Entry Accounting Services

This directory contains the business logic services for the double-entry accounting system.

## Services

### GLPostingService
Central service for creating double-entry GL postings.

**Key Methods:**
- `postGLEntries(request, transaction)`: Post balanced GL entries

**Features:**
- Validates debit = credit balance
- Auto-generates entry numbers (JE-YYYY-NNNNNN)
- Updates account balances automatically
- Transaction-safe with rollback protection

**Usage:**
```typescript
import GLPostingService from './services/accounting/GLPostingService';
import { SourceModule, EntryType } from './models/accounting/GeneralLedger';

await GLPostingService.postGLEntries({
  entryDate: new Date(),
  sourceModule: SourceModule.PURCHASE,
  sourceTransactionId: 123,
  sourceTransactionNumber: 'CP0001',
  entries: [
    {
      accountCode: '5000',
      entryType: EntryType.DEBIT,
      amount: 1000,
      description: 'Purchase of inventory'
    },
    {
      accountCode: '1020',
      entryType: EntryType.CREDIT,
      amount: 1000,
      description: 'Bank payment'
    }
  ]
}, transaction);
```

### AccountingRulesEngine
Defines debit/credit rules for each transaction type.

**Key Methods:**
- `getPurchaseGLEntries(amount, paymentType)`: Purchase GL entries
- `getPurchaseOnCreditGLEntries(amount)`: Purchase on credit
- `getSaleCashGLEntries(amount)`: Cash sale
- `getSaleOnCreditGLEntries(amount)`: Credit sale
- `getAPPaymentGLEntries(amount, method)`: AP payment
- `getARCollectionGLEntries(amount, method)`: AR collection
- `getBusinessExpenseGLEntries(amount, type, method)`: Expense

**Usage:**
```typescript
import AccountingRulesEngine from './services/accounting/AccountingRulesEngine';

// Get GL entries for a bank purchase
const entries = AccountingRulesEngine.getPurchaseGLEntries(1000, 'BANK');
// Returns:
// [
//   { accountCode: '5000', entryType: 'DEBIT', amount: 1000, description: '...' },
//   { accountCode: '1020', entryType: 'CREDIT', amount: 1000, description: '...' }
// ]
```

### ChartOfAccountsService
Manages GL account structure and hierarchy.

**Key Methods:**
- `getAllAccounts()`: Get all accounts
- `getAccountById(id)`: Get account by ID
- `getAccountByCode(code)`: Get account by code
- `createAccount(data)`: Create new account
- `initializeDefaultAccounts()`: Initialize default accounts

**Usage:**
```typescript
import ChartOfAccountsService from './services/accounting/ChartOfAccountsService';

// Get all accounts
const accounts = await ChartOfAccountsService.getAllAccounts();

// Get specific account
const cashAccount = await ChartOfAccountsService.getAccountByCode('1010');

// Create new account
const newAccount = await ChartOfAccountsService.createAccount({
  accountCode: '1030',
  accountName: 'Petty Cash',
  accountType: AccountType.ASSET,
  accountSubType: AccountSubType.CASH,
  level: 2
});
```

### TrialBalanceService
Generates trial balance and validates accounting equation.

**Key Methods:**
- `generateTrialBalance(asOfDate?)`: Generate trial balance report

**Usage:**
```typescript
import TrialBalanceService from './services/accounting/TrialBalanceService';

// Generate trial balance as of today
const trialBalance = await TrialBalanceService.generateTrialBalance();

console.log(`Total Debits: ${trialBalance.totalDebits}`);
console.log(`Total Credits: ${trialBalance.totalCredits}`);
console.log(`Balanced: ${trialBalance.isBalanced}`);

// Generate trial balance as of specific date
const historicalTB = await TrialBalanceService.generateTrialBalance(
  new Date('2024-12-31')
);
```

## Integration Examples

### Purchase Service Integration

```typescript
// In purchaseService.ts
import GLPostingService from './accounting/GLPostingService';
import AccountingRulesEngine from './accounting/AccountingRulesEngine';
import { SourceModule } from '../models/accounting/GeneralLedger';

async createPurchase(data: CreatePurchaseRequest): Promise<Purchase> {
  const transaction = await sequelize.transaction();
  
  try {
    // 1. Create purchase (existing code)
    const purchase = await Purchase.create({ ... }, { transaction });
    
    // 2. Create bank register or AP (existing code)
    if (data.paymentType === 'BANK') {
      await BankRegister.create({ ... }, { transaction });
    }
    
    // 3. NEW: Post GL entries
    const glEntries = AccountingRulesEngine.getPurchaseGLEntries(
      data.total, 
      data.paymentType
    );
    
    await GLPostingService.postGLEntries({
      entryDate: purchase.date,
      sourceModule: SourceModule.PURCHASE,
      sourceTransactionId: purchase.id,
      sourceTransactionNumber: purchase.registrationNumber,
      entries: glEntries,
    }, transaction);
    
    await transaction.commit();
    return purchase;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

### Sale Service Integration

```typescript
// In saleService.ts
import GLPostingService from './accounting/GLPostingService';
import AccountingRulesEngine from './accounting/AccountingRulesEngine';
import { SourceModule } from '../models/accounting/GeneralLedger';

async createSale(data: CreateSaleRequest): Promise<Sale> {
  const transaction = await sequelize.transaction();
  
  try {
    // 1. Create sale (existing code)
    const sale = await Sale.create({ ... }, { transaction });
    
    // 2. Create cash register or AR (existing code)
    if (data.paymentType === 'CASH') {
      await CashRegister.create({ ... }, { transaction });
    }
    
    // 3. NEW: Post GL entries
    const glEntries = data.paymentType === 'CASH'
      ? AccountingRulesEngine.getSaleCashGLEntries(data.total)
      : AccountingRulesEngine.getSaleOnCreditGLEntries(data.total);
    
    await GLPostingService.postGLEntries({
      entryDate: sale.date,
      sourceModule: SourceModule.SALE,
      sourceTransactionId: sale.id,
      sourceTransactionNumber: sale.registrationNumber,
      entries: glEntries,
    }, transaction);
    
    await transaction.commit();
    return sale;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

## Error Handling

All services include comprehensive error handling:

```typescript
try {
  await GLPostingService.postGLEntries({
    entries: [
      { accountCode: '5000', entryType: 'DEBIT', amount: 1000 },
      { accountCode: '1020', entryType: 'CREDIT', amount: 999 }  // Not balanced!
    ]
  });
} catch (error) {
  // Error: "GL entries not balanced. Debits: 1000, Credits: 999, Difference: 1"
}
```

## Validation

Services automatically validate:
- Debit = Credit balance
- Account codes exist
- Amounts are positive
- Required fields present
- Transaction integrity

## Performance

Services are optimized for performance:
- Account balance caching
- Indexed queries
- Batch operations
- Transaction pooling

## Testing

Example test:
```typescript
import GLPostingService from './services/accounting/GLPostingService';

describe('GLPostingService', () => {
  it('should create balanced GL entries', async () => {
    const entries = await GLPostingService.postGLEntries({
      entryDate: new Date(),
      sourceModule: SourceModule.PURCHASE,
      sourceTransactionId: 1,
      sourceTransactionNumber: 'CP0001',
      entries: [
        { accountCode: '5000', entryType: 'DEBIT', amount: 1000 },
        { accountCode: '1020', entryType: 'CREDIT', amount: 1000 }
      ]
    });
    
    expect(entries).toHaveLength(2);
    expect(entries[0].entryType).toBe('DEBIT');
    expect(entries[1].entryType).toBe('CREDIT');
  });
});
```

## See Also

- Models: `../models/accounting/`
- Controllers: `../controllers/accounting/`
- Routes: `../routes/accounting/`
- Documentation: Root directory `DOUBLE_ENTRY_*.md` files

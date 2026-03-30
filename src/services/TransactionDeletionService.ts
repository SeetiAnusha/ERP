// /**
//  * Enterprise-Grade Transaction Deletion Service
//  * 
//  * DSA Approach: Graph-based dependency resolution with O(n) complexity
//  * Features: Automatic payment reversal, dependency graph traversal, optimized batch operations
//  * 
//  * Time Complexity: O(V + E) where V = transactions, E = relationships
//  * Space Complexity: O(V) for dependency tracking
//  */

// import * as creditBalanceService from './creditBalanceService';
// import * as cashRegisterService from './cashRegisterService';
// import AccountsReceivable from '../models/AccountsReceivable';
// import sequelize from '../config/database';
// import { Transaction, Op } from 'sequelize';
// import Payment from '../models/Payment';
// import PaymentInvoiceApplication from '../models/PaymentInvoiceApplication';
// import Purchase from '../models/Purchase';
// import Sale from '../models/Sale';
// import AccountsPayable from '../models/AccountsPayable';
// import BankRegister from '../models/BankRegister';
// import CashRegister from '../models/CashRegister';
// import ApprovalRequest from '../models/ApprovalRequest';
// import TransactionAuditTrail from '../models/TransactionAuditTrail';
// import BusinessExpense from '../models/BusinessExpense';
// import { BaseService } from '../core/BaseService';
// import { NotFoundError, BusinessLogicError } from '../core/AppError';
// import crypto from 'crypto';
// import BankAccount from '../models/BankAccount';

// interface ExecuteDeletionData {
//   approvalRequestId: number;
//   executedBy: number;
//   ipAddress?: string;
//   userAgent?: string;
// }

// /**
//  * Transaction Dependency Graph Node
//  * Used for DSA-based dependency resolution
//  */
// interface TransactionNode {
//   id: number;
//   type: 'PURCHASE' | 'SALE' | 'PAYMENT' | 'BANK_REGISTER' | 'CASH_REGISTER' | 'AP' | 'AR' | 'BUSINESS_EXPENSE';
//   registrationNumber: string;
//   amount: number;
//   status: string;
//   dependencies: TransactionNode[];
//   dependents: TransactionNode[];
//   processed: boolean;
// }

// /**
//  * Reversal Operation for batch processing
//  * Optimizes database operations using batch inserts
//  */
// interface ReversalOperation {
//   type: 'BANK_REVERSAL' | 'CASH_REVERSAL' | 'CC_REGISTER_REVERSAL' | 'STATUS_UPDATE' | 'SOFT_DELETE' | 'CREATE_REVERSAL_AP' | 'CREATE_MANUAL_TASK' | 'RESTORE_CREDIT_LIMIT' | 'BANK_BALANCE_UPDATE';
//   targetTable: string;
//   targetId: number;
//   data: any;
//   priority: number; // For topological sorting
// }
// /**
//  * Enterprise Transaction Deletion Service
//  * 
//  * Implements graph-based dependency resolution with automatic payment reversal
//  * Handles all transaction types with O(V + E) complexity optimization
//  */
// class TransactionDeletionService extends BaseService {

//   /**
//    * Execute an approved deletion request with dependency resolution
//    * 
//    * Algorithm: Topological sort + DFS for dependency graph traversal
//    * Time Complexity: O(V + E) where V = transactions, E = relationships
//    */
//   async executeApprovedDeletion(data: ExecuteDeletionData): Promise<void> {
//     return this.executeWithTransaction(async (transaction) => {
//       console.log("Data:",data);
//       console.log(`🚀 [DSA-Optimized] Starting deletion execution for request ${data.approvalRequestId}`);
      
//       // Step 1: Validate approval request
//       const approvalRequest = await this.validateApprovalRequest(data.approvalRequestId, transaction);
      
//       // Step 2: Build transaction dependency graph
//       const dependencyGraph = await this.buildTransactionDependencyGraph(
//         approvalRequest.entity_type, 
//         approvalRequest.entity_id, 
//         transaction
//       );
      
//       console.log(`📊 [Graph Analysis] Built dependency graph with ${dependencyGraph.nodes.length} nodes, ${dependencyGraph.edges.length} edges`);
      
//       // Step 3: Perform topological sort for optimal deletion order
//       const deletionOrder = this.topologicalSort(dependencyGraph);
//       console.log(`🔄 [Topological Sort] Deletion order: ${deletionOrder.map(n => n.registrationNumber).join(' → ')}`);
      
//       // Step 4: Execute deletions in dependency-safe order
//       const reversalOperations: ReversalOperation[] = [];
      
//       for (const node of deletionOrder) {
//         console.log(`🔧 [Processing Node] ${node.type} ID ${node.id} (${node.registrationNumber})`);
//         const operations = await this.generateReversalOperations(node, approvalRequest, data.executedBy, transaction);
//         console.log(`📋 [Generated Operations] ${operations.length} operations for ${node.type} ${node.id}:`, operations.map(op => `${op.type}:${op.targetTable}:${op.targetId}`));
//         reversalOperations.push(...operations);
//       }
      
//       console.log(`🎯 [Total Operations] Generated ${reversalOperations.length} total operations`);
      
//       // Step 5: Batch execute all operations (optimized for performance)
//       await this.executeBatchOperations(reversalOperations, transaction);
      
//       // Step 6: Mark approval as executed and create audit trail
//       await this.finalizeExecution(approvalRequest, data, transaction);
      
//       console.log(`✅ [Execution Complete] Successfully deleted ${approvalRequest.entity_type} ${approvalRequest.entity_id} with ${reversalOperations.length} operations`);
//     });
//   }
//   /**
//    * Build transaction dependency graph using BFS traversal
//    * 
//    * Algorithm: Breadth-First Search to discover all related transactions
//    * Time Complexity: O(V + E)
//    */
//   private async buildTransactionDependencyGraph(
//     entityType: string, 
//     entityId: number, 
//     transaction: Transaction
//   ): Promise<{ nodes: TransactionNode[], edges: Array<{from: number, to: number}> }> {
//     const nodes: Map<string, TransactionNode> = new Map();
//     const edges: Array<{from: number, to: number}> = [];
//     const visited: Set<string> = new Set();
//     const queue: Array<{type: string, id: number}> = [];
    
//     console.log(`🔍 [Graph Building] Starting with entity: ${entityType} ID ${entityId}`);
    
//     // Start BFS from root entity
//     queue.push({ type: entityType.toUpperCase(), id: entityId });
    
//     while (queue.length > 0) {
//       const current = queue.shift()!;
//       console.log("current:",current);
//       const nodeKey = `${current.type}_${current.id}`;
      
//       console.log(`🔍 [Graph Building] Processing: ${nodeKey}`);
      
//       if (visited.has(nodeKey)) continue;
//       visited.add(nodeKey);
      
//       // Discover node and its relationships
//       const nodeData = await this.discoverTransactionNode(current.type, current.id, transaction);
//       if (nodeData) {
//         console.log(`✅ [Graph Building] Found node: ${nodeData.type} ${nodeData.id} (${nodeData.registrationNumber})`);
//         nodes.set(nodeKey, nodeData);
        
//         // Discover related transactions (payments, registers, etc.)
//         const relatedTransactions = await this.discoverRelatedTransactions(nodeData, transaction);
//         console.log(`🔗 [Graph Building] Found ${relatedTransactions.length} related transactions for ${nodeKey}`);
        
//         for (const related of relatedTransactions) {
//           const relatedKey = `${related.type}_${related.id}`;
//           if (!visited.has(relatedKey)) {
//             queue.push({ type: related.type, id: related.id });
//             edges.push({ from: current.id, to: related.id });
//           }
//         }
//       } else {
//         console.warn(`⚠️ [Graph Building] No node data found for: ${nodeKey}`);
//       }
//     }
    
//     console.log(`📊 [Graph Building] Final graph: ${nodes.size} nodes, ${edges.length} edges`);
//     return { nodes: Array.from(nodes.values()), edges };
//   }
//   /**
//    * Discover transaction node with all its properties
//    * 
//    * Polymorphic method handling all transaction types
//    */
//   private async discoverTransactionNode(
//     type: string, 
//     id: number, 
//     transaction: Transaction
//   ): Promise<TransactionNode | null> {
//     let entity: any = null;
//     let amount = 0;
//     let status = '';
//     let registrationNumber = '';
    
//     console.log(`🔍 [Node Discovery] Looking for ${type.toLowerCase()} with ID ${id}`);
    
//     switch (type.toLowerCase()) {
//       case 'purchase':
//         entity = await Purchase.findByPk(id, { transaction });
//         if (entity) {
//           amount = parseFloat(entity.total.toString());
//           status = entity.paymentStatus;
//           registrationNumber = entity.registrationNumber;
//         }
//         break;
        
//       case 'sale':
//         entity = await Sale.findByPk(id, { transaction });
//         if (entity) {
//           amount = parseFloat(entity.total.toString());
//           status = entity.collectionStatus;
//           registrationNumber = entity.registrationNumber;
//         }
//         break;
        
//       case 'business_expense':
//       case 'businessexpense':
//         const BusinessExpense = (await import('../models/BusinessExpense')).default;
//         entity = await BusinessExpense.findByPk(id, { transaction });
//         if (entity) {
//           amount = parseFloat(entity.amount.toString());
//           status = entity.paymentStatus || 'Pending';
//           registrationNumber = entity.registrationNumber;
//           console.log(`✅ [Business Expense Found] ${registrationNumber}: amount=${amount}, status=${status}, paymentType=${entity.paymentType}`);
//         }

//         break;
        
//       case 'bank_register':
//       case 'bankregister':
//         entity = await BankRegister.findByPk(id, { transaction });
//         if (entity) {
//           amount = parseFloat(entity.amount.toString());
//           status = entity.transactionType;
//           registrationNumber = entity.registrationNumber;
//         }
//         break;
        
//       case 'cash_register':
//       case 'cashregister':
//         entity = await CashRegister.findByPk(id, { transaction });
//         if (entity) {
//           amount = parseFloat(entity.amount.toString());
//           status = entity.transactionType;
//           registrationNumber = entity.registrationNumber;
//         }
//         break;
        
//       case 'ap':
//       case 'accountspayable':
//       case 'accounts_payable':
//         entity = await AccountsPayable.findByPk(id, { transaction });
//         if (entity) {
//           amount = parseFloat(entity.amount.toString());
//           status = entity.status;
//           registrationNumber = entity.registrationNumber;
//           console.log(`✅ [AP Found] ${registrationNumber}: amount=${amount}, status=${status}, paymentType=${entity.paymentType}, paidAmount=${entity.paidAmount}`);
//         }
//         break;
        
//       case 'ar':
//       case 'accountsreceivable':
//       case 'accounts_receivable':
//         entity = await AccountsReceivable.findByPk(id, { transaction });
//         if (entity) {
//           amount = parseFloat(entity.amount.toString());
//           status = entity.status;
//           registrationNumber = entity.registrationNumber;
//         }
//         break;
//     }
    
//     if (!entity) {
//       console.warn(`⚠️ [Node Discovery] No entity found for ${type} ID ${id}`);
//       return null;
//     }
    
//     console.log(`✅ [Node Discovery] Found ${type} ${id}: ${registrationNumber}`);
    
//     // Normalize entity types for consistency
//     let normalizedType = type.toUpperCase();
//     if (normalizedType === 'ACCOUNTSPAYABLE' || normalizedType === 'ACCOUNTS_PAYABLE') {
//       normalizedType = 'AP';
//     } else if (normalizedType === 'ACCOUNTSRECEIVABLE' || normalizedType === 'ACCOUNTS_RECEIVABLE') {
//       normalizedType = 'AR';
//     } else if (normalizedType === 'BUSINESSEXPENSE') {
//       normalizedType = 'BUSINESS_EXPENSE';
//     } else if (normalizedType === 'BANKREGISTER') {  // ✅ FIX: Normalize BANKREGISTER to BANK_REGISTER
//       normalizedType = 'BANK_REGISTER';
//     } else if (normalizedType === 'CASHREGISTER') {  // ✅ FIX: Normalize CASHREGISTER to CASH_REGISTER
//       normalizedType = 'CASH_REGISTER';
//     }
    
//     return {
//       id,
//       type: normalizedType as any,
//       registrationNumber,
//       amount,
//       status,
//       dependencies: [],
//       dependents: [],
//       processed: false
//     };
//   }
//   /**
//    * Discover related transactions using optimized queries
//    * 
//    * Uses indexed queries for O(log n) lookup performance
//    */
//   private async discoverRelatedTransactions(
//     node: TransactionNode, 
//     transaction: Transaction
//   ): Promise<Array<{type: string, id: number}>> {
//     const related: Array<{type: string, id: number}> = [];
    
//     switch (node.type) {
//       case 'PURCHASE':
//         // Find related AP records
//         const apRecords = await AccountsPayable.findAll({
//           where: { relatedDocumentNumber: node.registrationNumber },
//           attributes: ['id'],
//           transaction
//         });
//         related.push(...apRecords.map(ap => ({ type: 'AP', id: ap.id })));
        
//         // Find related bank/cash register entries
//         const bankEntries = await BankRegister.findAll({
//           where: { relatedDocumentNumber: node.registrationNumber },
//           attributes: ['id'],
//           transaction
//         });
//         related.push(...bankEntries.map(br => ({ type: 'BANK_REGISTER', id: br.id })));
        
//         const cashEntries = await CashRegister.findAll({
//           where: { relatedDocumentNumber: node.registrationNumber },
//           attributes: ['id'],
//           transaction
//         });
//         related.push(...cashEntries.map(cr => ({ type: 'CASH_REGISTER', id: cr.id })));
//         break;
        
//       case 'BUSINESS_EXPENSE':
//         // Find related AP records for business expenses
//         const expenseAPRecords = await AccountsPayable.findAll({
//           where: { relatedDocumentNumber: node.registrationNumber },
//           attributes: ['id'],
//           transaction
//         });
//         related.push(...expenseAPRecords.map(ap => ({ type: 'AP', id: ap.id })));
        
//         // Find related bank/cash register entries for business expenses
//         const expenseBankEntries = await BankRegister.findAll({
//           where: { relatedDocumentNumber: node.registrationNumber },
//           attributes: ['id'],
//           transaction
//         });
//         related.push(...expenseBankEntries.map(br => ({ type: 'BANK_REGISTER', id: br.id })));
        
//         const expenseCashEntries = await CashRegister.findAll({
//           where: { relatedDocumentNumber: node.registrationNumber },
//           attributes: ['id'],
//           transaction
//         });
//         related.push(...expenseCashEntries.map(cr => ({ type: 'CASH_REGISTER', id: cr.id })));
//         break;
        
//       case 'SALE':
//         // Find related AR records
//         const arRecords = await AccountsReceivable.findAll({
//           where: { relatedDocumentNumber: node.registrationNumber },
//           attributes: ['id'],
//           transaction
//         });
//         related.push(...arRecords.map(ar => ({ type: 'AR', id: ar.id })));
        
//         // Find related register entries
//         const saleBankEntries = await BankRegister.findAll({
//           where: { relatedDocumentNumber: node.registrationNumber },
//           attributes: ['id'],
//           transaction
//         });
//         related.push(...saleBankEntries.map(br => ({ type: 'BANK_REGISTER', id: br.id })));
        
//         const saleCashEntries = await CashRegister.findAll({
//           where: { relatedDocumentNumber: node.registrationNumber },
//           attributes: ['id'],
//           transaction
//         });
//         related.push(...saleCashEntries.map(cr => ({ type: 'CASH_REGISTER', id: cr.id })));
//         break;
        
//       case 'AP':
//         // Find related bank/cash register entries for AP payments
//         const apBankEntries = await BankRegister.findAll({
//           where: { relatedDocumentNumber: node.registrationNumber },
//           attributes: ['id'],
//           transaction
//         });
//         related.push(...apBankEntries.map(br => ({ type: 'BANK_REGISTER', id: br.id })));
        
//         const apCashEntries = await CashRegister.findAll({
//           where: { relatedDocumentNumber: node.registrationNumber },
//           attributes: ['id'],
//           transaction
//         });
//         related.push(...apCashEntries.map(cr => ({ type: 'CASH_REGISTER', id: cr.id })));
        
//         // ✅ NEW: Find related business expense for AP entries that originated from expenses
//         const ap = await AccountsPayable.findByPk(node.id, { 
//           attributes: ['relatedDocumentType', 'relatedDocumentId'],
//           transaction 
//         });
//         if (ap && ap.relatedDocumentType === 'Business Expense' && ap.relatedDocumentId) {
//           related.push({ type: 'BUSINESS_EXPENSE', id: ap.relatedDocumentId });
//         }
//         break;
        
//       case 'AR':
//         // Find related bank/cash register entries for AR collections
//         const arBankEntries = await BankRegister.findAll({
//           where: { relatedDocumentNumber: node.registrationNumber },
//           attributes: ['id'],
//           transaction
//         });
//         related.push(...arBankEntries.map(br => ({ type: 'BANK_REGISTER', id: br.id })));
        
//         const arCashEntries = await CashRegister.findAll({
//           where: { relatedDocumentNumber: node.registrationNumber },
//           attributes: ['id'],
//           transaction
//         });
//         related.push(...arCashEntries.map(cr => ({ type: 'CASH_REGISTER', id: cr.id })));
//         break;
//     }
    
//     return related;
//   }
//   /**
//    * Topological sort for dependency-safe deletion order
//    * 
//    * Algorithm: Kahn's algorithm for topological sorting
//    * Time Complexity: O(V + E)
//    */
//   private topologicalSort(graph: { nodes: TransactionNode[], edges: Array<{from: number, to: number}> }): TransactionNode[] {
//     const inDegree: Map<number, number> = new Map();
//     const adjList: Map<number, number[]> = new Map();
//     const nodeMap: Map<number, TransactionNode> = new Map();
    
//     // Initialize data structures
//     for (const node of graph.nodes) {
//       inDegree.set(node.id, 0);
//       adjList.set(node.id, []);
//       nodeMap.set(node.id, node);
//     }
    
//     // Build adjacency list and calculate in-degrees
//     for (const edge of graph.edges) {
//       adjList.get(edge.from)?.push(edge.to);
//       inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
//     }
    
//     // Kahn's algorithm
//     const queue: number[] = [];
//     const result: TransactionNode[] = [];
    
//     // Find nodes with no incoming edges
//     for (const [nodeId, degree] of inDegree) {
//       if (degree === 0) {
//         queue.push(nodeId);
//       }
//     }
    
//     while (queue.length > 0) {
//       const currentId = queue.shift()!;
//       const currentNode = nodeMap.get(currentId)!;
//       result.push(currentNode);
      
//       // Process neighbors
//       for (const neighborId of adjList.get(currentId) || []) {
//         inDegree.set(neighborId, inDegree.get(neighborId)! - 1);
//         if (inDegree.get(neighborId) === 0) {
//           queue.push(neighborId);
//         }
//       }
//     }
    
//     // Reverse for deletion order (dependents first)
//     return result.reverse();
//   }
//   /**
//    * Generate reversal operations for a transaction node
//    * 
//    * Smart operation generation based on transaction type and status
//    */
//   private async generateReversalOperations(
//     node: TransactionNode,
//     approvalRequest: ApprovalRequest,
//     executedBy: number,
//     transaction: Transaction
//   ): Promise<ReversalOperation[]> {
//     const operations: ReversalOperation[] = [];
    
//     console.log(`🔧 [Generate Reversal] Processing node type: ${node.type} (ID: ${node.id})`);
    
//     switch (node.type) {
//       case 'PURCHASE':
//         console.log(`📦 [Generate Reversal] Calling generatePurchaseReversalOperations`);
//         operations.push(...await this.generatePurchaseReversalOperations(node, approvalRequest, executedBy, transaction));
//         break;
//       case 'SALE':
//         console.log(`💰 [Generate Reversal] Calling generateSaleReversalOperations`);
//         operations.push(...await this.generateSaleReversalOperations(node, approvalRequest, executedBy, transaction));
//         break;
//       case 'BANK_REGISTER':
//         console.log(`🏦 [Generate Reversal] Calling generateBankRegisterReversalOperations`);
//         operations.push(...await this.generateBankRegisterReversalOperations(node, approvalRequest, executedBy, transaction));
//         break;
//       case 'CASH_REGISTER':
//         console.log(`💵 [Generate Reversal] Calling generateCashRegisterReversalOperations`);
//         operations.push(...await this.generateCashRegisterReversalOperations(node, approvalRequest, executedBy, transaction));
//         break;
//       case 'AP':
//         console.log(`📋 [Generate Reversal] Calling generateAPReversalOperations`);
//         operations.push(...await this.generateAPReversalOperations(node, approvalRequest, executedBy, transaction));
//         break;
//       case 'AR':
//         console.log(`📊 [Generate Reversal] Calling generateARReversalOperations`);
//         operations.push(...await this.generateARReversalOperations(node, approvalRequest, executedBy, transaction));
//         break;
//       case 'BUSINESS_EXPENSE':
//         console.log(`💼 [Generate Reversal] Calling generateBusinessExpenseReversalOperations`);
//         operations.push(...await this.generateBusinessExpenseReversalOperations(node, approvalRequest, executedBy, transaction));
//         break;
//       default:
//         console.warn(`⚠️ [Generate Reversal] Unknown node type: ${node.type}`);
//     }
    
//     console.log(`✅ [Generate Reversal] Generated ${operations.length} operations for ${node.type} ${node.id}`);
//     return operations;
//   }
//   /**
//    * Enhanced Purchase Deletion with Automatic Payment Reversal
//    * 
//    * Handles paid purchases by automatically reversing all related payments
//    */
//   private async generatePurchaseReversalOperations(
//     node: TransactionNode,
//     approvalRequest: ApprovalRequest,
//     executedBy: number,
//     transaction: Transaction
//   ): Promise<ReversalOperation[]> {
//     const operations: ReversalOperation[] = [];
    
//     // Get full purchase data
//     const purchase = await Purchase.findByPk(node.id, { transaction });
//     if (!purchase) return operations;
    
//     const paidAmount = parseFloat(purchase.paidAmount.toString());
    
//     console.log(`💰 [Purchase Analysis] ${purchase.registrationNumber}: Total=${purchase.total}, Paid=${paidAmount}, Status=${purchase.paymentStatus}`);
    
//     // ✅ ENHANCED: Automatically handle paid purchases
//     if (paidAmount > 0) {
//       console.log(`🔄 [Auto-Reversal] Purchase has been paid ${paidAmount}. Generating automatic payment reversals...`);
      
//       // Find and reverse all related bank register entries
//       const bankEntries = await BankRegister.findAll({
//         where: { 
//           relatedDocumentNumber: purchase.registrationNumber,
//           deletion_status: { [Op.ne]: 'EXECUTED' }
//         },
//         transaction
//       });
      
//       for (const bankEntry of bankEntries) {
//         // Generate bank reversal operation
//         operations.push({
//           type: 'BANK_REVERSAL',
//           targetTable: 'bank_registers',
//           targetId: bankEntry.id,
//           data: {
//             originalEntry: bankEntry,
//             reversalType: bankEntry.transactionType === 'OUTFLOW' ? 'INFLOW' : 'OUTFLOW',
//             amount: bankEntry.amount,
//             description: `Reversal of ${bankEntry.registrationNumber} - Purchase deletion (${approvalRequest.deletion_reason_code})`,
//             deletion_approval_id: approvalRequest.id
//           },
//           priority: 1 // High priority - reverse payments first
//         });
        
//         console.log(`🏦 [Bank Reversal] Queued reversal for ${bankEntry.registrationNumber} (${bankEntry.transactionType} ${bankEntry.amount})`);
//       }
      
//       // Find and reverse cash register entries
//       const cashEntries = await CashRegister.findAll({
//         where: { 
//           relatedDocumentNumber: purchase.registrationNumber,
//           deletion_status: { [Op.ne]: 'EXECUTED' }
//         },
//         transaction
//       });
      
//       for (const cashEntry of cashEntries) {
//         operations.push({
//           type: 'CASH_REVERSAL',
//           targetTable: 'cash_registers',
//           targetId: cashEntry.id,
//           data: {
//             originalEntry: cashEntry,
//             reversalType: cashEntry.transactionType === 'INFLOW' ? 'OUTFLOW' : 'INFLOW',
//             amount: cashEntry.amount,
//             description: `Reversal of ${cashEntry.registrationNumber} - Purchase deletion (${approvalRequest.deletion_reason_code})`,
//             deletion_approval_id: approvalRequest.id
//           },
//           priority: 1
//         });
        
//         console.log(`💰 [Cash Reversal] Queued reversal for ${cashEntry.registrationNumber} (${cashEntry.transactionType} ${cashEntry.amount})`);
//       }
      
//       // Reset purchase payment status
//       operations.push({
//         type: 'STATUS_UPDATE',
//         targetTable: 'purchases',
//         targetId: purchase.id,
//         data: {
//           paidAmount: 0,
//           balanceAmount: parseFloat(purchase.total.toString()),
//           paymentStatus: 'Unpaid'
//         },
//         priority: 2
//       });
      
//       console.log(`📝 [Status Reset] Purchase will be reset to unpaid status`);
//     }
    
//     // Update related AP records
//     operations.push({
//       type: 'SOFT_DELETE',
//       targetTable: 'accounts_payables',
//       targetId: 0, // Will be resolved by related document number
//       data: {
//         relatedDocumentNumber: purchase.registrationNumber,
//         deletion_status: 'EXECUTED',
//         deleted_at: new Date(),
//         deleted_by: executedBy,
//         deletion_reason_code: approvalRequest.deletion_reason_code,
//         deletion_memo: approvalRequest.custom_memo,
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 3
//     });
    
//     // Soft delete the purchase
//     operations.push({
//       type: 'SOFT_DELETE',
//       targetTable: 'purchases',
//       targetId: purchase.id,
//       data: {
//         deletion_status: 'EXECUTED',
//         deleted_at: new Date(),
//         deleted_by: executedBy,
//         deletion_reason_code: approvalRequest.deletion_reason_code,
//         deletion_memo: approvalRequest.custom_memo,
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 4 // Lowest priority - delete main record last
//     });
    
//     console.log(`✅ [Purchase Operations] Generated ${operations.length} operations for ${purchase.registrationNumber}`);
//     return operations;
//   }

//   /**
//    * ✅ NEW: Generate reversal operations for business expenses
//    */
//   private async generateBusinessExpenseReversalOperations(
//     node: TransactionNode,
//     approvalRequest: ApprovalRequest,
//     executedBy: number,
//     transaction: Transaction
//   ): Promise<ReversalOperation[]> {
//     const operations: ReversalOperation[] = [];
    
//     // Get full business expense data
//     const BusinessExpense = (await import('../models/BusinessExpense')).default;
//     const expense = await BusinessExpense.findByPk(node.id, { transaction });
//     if (!expense) return operations;
    
//     const paidAmount = parseFloat(expense.paidAmount?.toString() || '0');
    
//     console.log(`💼 [Business Expense Analysis] ${expense.registrationNumber}: Total=${expense.amount}, Paid=${paidAmount}, Status=${expense.paymentStatus}`);
    
//     // ✅ Handle paid business expenses - reverse payments
//     if (paidAmount > 0) {
//       console.log(`🔄 [Auto-Reversal] Business expense has been paid ${paidAmount}. Generating automatic payment reversals...`);
      
//       // Find and reverse all related bank register entries
//       const bankEntries = await BankRegister.findAll({
//         where: { 
//           relatedDocumentNumber: expense.registrationNumber,
//           deletion_status: { [Op.ne]: 'EXECUTED' }
//         },
//         transaction
//       });
      
//       for (const bankEntry of bankEntries) {
//         operations.push({
//           type: 'BANK_REVERSAL',
//           targetTable: 'bank_registers',
//           targetId: bankEntry.id,
//           data: {
//             originalEntry: bankEntry,
//             reversalType: bankEntry.transactionType === 'OUTFLOW' ? 'INFLOW' : 'OUTFLOW',
//             amount: bankEntry.amount,
//             description: `Reversal of ${bankEntry.registrationNumber} - Business expense deletion (${approvalRequest.deletion_reason_code})`,
//             deletion_approval_id: approvalRequest.id,
//             apRegistrationNumber: expense.registrationNumber
//           },
//           priority: 1
//         });
        
//         console.log(`🏦 [Bank Reversal] Queued reversal for ${bankEntry.registrationNumber} (${bankEntry.transactionType} ${bankEntry.amount})`);
//       }
      
//       // Find and reverse cash register entries
//       const cashEntries = await CashRegister.findAll({
//         where: { 
//           relatedDocumentNumber: expense.registrationNumber,
//           deletion_status: { [Op.ne]: 'EXECUTED' }
//         },
//         transaction
//       });
      
//       for (const cashEntry of cashEntries) {
//         operations.push({
//           type: 'CASH_REVERSAL',
//           targetTable: 'cash_registers',
//           targetId: cashEntry.id,
//           data: {
//             originalEntry: cashEntry,
//             reversalType: cashEntry.transactionType === 'INFLOW' ? 'OUTFLOW' : 'INFLOW',
//             amount: cashEntry.amount,
//             description: `Reversal of ${cashEntry.registrationNumber} - Business expense deletion (${approvalRequest.deletion_reason_code})`,
//             deletion_approval_id: approvalRequest.id
//           },
//           priority: 1
//         });
        
//         console.log(`💰 [Cash Reversal] Queued reversal for ${cashEntry.registrationNumber} (${cashEntry.transactionType} ${cashEntry.amount})`);
//       }
//     }
    
//     // ✅ Update business expense status to REVERSED
//     operations.push({
//       type: 'STATUS_UPDATE',
//       targetTable: 'business_expenses',
//       targetId: expense.id,
//       data: {
//         paymentStatus: 'REVERSED',
//         paidAmount: 0,
//         balanceAmount: parseFloat(expense.amount.toString()),
//         paidDate: null,
//         description: `${expense.description || ''} | REVERSED: ${approvalRequest.deletion_reason_code}`.trim(),
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 2
//     });
    
//     // Update related AP records (mark as reversed)
//     operations.push({
//       type: 'SOFT_DELETE',
//       targetTable: 'accounts_payables',
//       targetId: 0, // Will be resolved by related document number
//       data: {
//         relatedDocumentNumber: expense.registrationNumber,
//         deletion_status: 'EXECUTED',
//         deleted_at: new Date(),
//         deleted_by: executedBy,
//         deletion_reason_code: approvalRequest.deletion_reason_code,
//         deletion_memo: approvalRequest.custom_memo,
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 3
//     });
    
//     // ✅ Soft delete the business expense (for audit trail)
//     operations.push({
//       type: 'SOFT_DELETE',
//       targetTable: 'business_expenses',
//       targetId: expense.id,
//       data: {
//         deletion_status: 'EXECUTED',
//         deleted_at: new Date(),
//         deleted_by: executedBy,
//         deletion_reason_code: approvalRequest.deletion_reason_code,
//         deletion_memo: approvalRequest.custom_memo || `Business expense reversed - ${expense.supplier?.name || 'Unknown Supplier'}`,
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 4
//     });
    
//     console.log(`✅ [Business Expense Operations] Generated ${operations.length} operations for ${expense.registrationNumber}`);
//     return operations;
//   }
//   /**
//    * Enhanced Sale Deletion with Automatic Collection Reversal
//    */
//   private async generateSaleReversalOperations(
//     node: TransactionNode,
//     approvalRequest: ApprovalRequest,
//     executedBy: number,
//     transaction: Transaction
//   ): Promise<ReversalOperation[]> {
//     const operations: ReversalOperation[] = [];
    
//     const sale = await Sale.findByPk(node.id, { transaction });
//     if (!sale) return operations;
    
//     const collectedAmount = parseFloat(sale.collectedAmount?.toString() || '0');
    
//     console.log(`💰 [Sale Analysis] ${sale.registrationNumber}: Total=${sale.total}, Collected=${collectedAmount}, Status=${sale.collectionStatus}`);
    
//     // ✅ ENHANCED: Automatically handle collected sales
//     if (collectedAmount > 0) {
//       console.log(`🔄 [Auto-Reversal] Sale has been collected ${collectedAmount}. Generating automatic collection reversals...`);
      
//       // Reverse bank register entries
//       const bankEntries = await BankRegister.findAll({
//         where: { 
//           relatedDocumentNumber: sale.registrationNumber,
//           deletion_status: { [Op.ne]: 'EXECUTED' }
//         },
//         transaction
//       });
      
//       for (const bankEntry of bankEntries) {
//         operations.push({
//           type: 'BANK_REVERSAL',
//           targetTable: 'bank_registers',
//           targetId: bankEntry.id,
//           data: {
//             originalEntry: bankEntry,
//             reversalType: bankEntry.transactionType === 'INFLOW' ? 'OUTFLOW' : 'INFLOW',
//             amount: bankEntry.amount,
//             description: `Reversal of ${bankEntry.registrationNumber} - Sale deletion (${approvalRequest.deletion_reason_code})`,
//             deletion_approval_id: approvalRequest.id
//           },
//           priority: 1
//         });
//       }
      
//       // Reverse cash register entries
//       const cashEntries = await CashRegister.findAll({
//         where: { 
//           relatedDocumentNumber: sale.registrationNumber,
//           deletion_status: { [Op.ne]: 'EXECUTED' }
//         },
//         transaction
//       });
      
//       for (const cashEntry of cashEntries) {
//         operations.push({
//           type: 'CASH_REVERSAL',
//           targetTable: 'cash_registers',
//           targetId: cashEntry.id,
//           data: {
//             originalEntry: cashEntry,
//             reversalType: cashEntry.transactionType === 'INFLOW' ? 'OUTFLOW' : 'INFLOW',
//             amount: cashEntry.amount,
//             description: `Reversal of ${cashEntry.registrationNumber} - Sale deletion (${approvalRequest.deletion_reason_code})`,
//             deletion_approval_id: approvalRequest.id
//           },
//           priority: 1
//         });
//       }
      
//       // Reset sale collection status
//       operations.push({
//         type: 'STATUS_UPDATE',
//         targetTable: 'sales',
//         targetId: sale.id,
//         data: {
//           collectedAmount: 0,
//           balanceAmount: parseFloat(sale.total.toString()),
//           collectionStatus: 'Not Collected'
//         },
//         priority: 2
//       });
//     }
    
//     // Update related AR records
//     operations.push({
//       type: 'SOFT_DELETE',
//       targetTable: 'accounts_receivables',
//       targetId: 0,
//       data: {
//         relatedDocumentNumber: sale.registrationNumber,
//         deletion_status: 'EXECUTED',
//         deleted_at: new Date(),
//         deleted_by: executedBy,
//         deletion_reason_code: approvalRequest.deletion_reason_code,
//         deletion_memo: approvalRequest.custom_memo,
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 3
//     });
    
//     // Soft delete the sale
//     operations.push({
//       type: 'SOFT_DELETE',
//       targetTable: 'sales',
//       targetId: sale.id,
//       data: {
//         deletion_status: 'EXECUTED',
//         deleted_at: new Date(),
//         deleted_by: executedBy,
//         deletion_reason_code: approvalRequest.deletion_reason_code,
//         deletion_memo: approvalRequest.custom_memo,
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 4
//     });
    
//     return operations;
//   }
//   /**
//    * Generate Bank Register reversal operations
//    */
//   private async generateBankRegisterReversalOperations(
//     node: TransactionNode,
//     approvalRequest: ApprovalRequest,
//     executedBy: number,
//     transaction: Transaction
//   ): Promise<ReversalOperation[]> {
//     const operations: ReversalOperation[] = [];
    
//     const br = await BankRegister.findByPk(node.id, { transaction });
//     if (!br) return operations;
    
//     // Create reversal entry
//     operations.push({
//       type: 'BANK_REVERSAL',
//       targetTable: 'bank_registers',
//       targetId: br.id,
//       data: {
//         originalEntry: br,
//         reversalType: br.transactionType === 'INFLOW' ? 'OUTFLOW' : 'INFLOW',
//         amount: br.amount,
//         description: `Reversal of ${br.registrationNumber} - ${approvalRequest.deletion_reason_code}`,
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 1
//     });
    
//     // Soft delete original
//     operations.push({
//       type: 'SOFT_DELETE',
//       targetTable: 'bank_registers',
//       targetId: br.id,
//       data: {
//         deletion_status: 'EXECUTED',
//         deleted_at: new Date(),
//         deleted_by: executedBy,
//         deletion_reason_code: approvalRequest.deletion_reason_code,
//         deletion_memo: approvalRequest.custom_memo,
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 2
//     });
    
//     return operations;
//   }

//   /**
//    * Generate Cash Register reversal operations
//    */
//   private async generateCashRegisterReversalOperations(
//     node: TransactionNode,
//     approvalRequest: ApprovalRequest,
//     executedBy: number,
//     transaction: Transaction
//   ): Promise<ReversalOperation[]> {
//     const operations: ReversalOperation[] = [];
    
//     const cr = await CashRegister.findByPk(node.id, { transaction });
//     if (!cr) return operations;
    
//     // Create reversal entry (this will automatically update Cash Register Master balance in executeCashReversalBatch)
//     operations.push({
//       type: 'CASH_REVERSAL',
//       targetTable: 'cash_registers',
//       targetId: cr.id,
//       data: {
//         originalEntry: cr,
//         reversalType: cr.transactionType === 'INFLOW' ? 'OUTFLOW' : 'INFLOW',
//         amount: cr.amount,
//         description: `Reversal of ${cr.registrationNumber} - ${approvalRequest.deletion_reason_code}`,
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 1
//     });
    
//     // Soft delete original
//     operations.push({
//       type: 'SOFT_DELETE',
//       targetTable: 'cash_registers',
//       targetId: cr.id,
//       data: {
//         deletion_status: 'EXECUTED',
//         deleted_at: new Date(),
//         deleted_by: executedBy,
//         deletion_reason_code: approvalRequest.deletion_reason_code,
//         deletion_memo: approvalRequest.custom_memo,
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 2
//     });
    
//     return operations;
//   }
//   /**
//    * Generate AP reversal operations with scenario-based handling
//    * 
//    * Handles 4 scenarios:
//    * 1. Credit Card Payment - Unpaid: Simple soft delete
//    * 2. Credit Card Payment - Paid: Complex reversal with card dispute
//    * 3. Credit Payment (Bank Transfer) - Unpaid: Simple soft delete  
//    * 4. Credit Payment (Bank Transfer) - Paid: Bank reversal + supplier negotiation
//    */
//   private async generateAPReversalOperations(
//     node: TransactionNode,
//     approvalRequest: ApprovalRequest,
//     executedBy: number,
//     transaction: Transaction
//   ): Promise<ReversalOperation[]> {
//     const ap = await AccountsPayable.findByPk(node.id, { transaction });
//     if (!ap) return [];

//     // 🎯 DETERMINE AP DELETION SCENARIO
//     const scenario = this.determineAPDeletionScenario(ap);
//     console.log(`🔍 [AP Scenario] ${ap.registrationNumber}: ${scenario.type} - ${scenario.description}`);

//     // 🚀 EXECUTE SCENARIO-SPECIFIC DELETION
//     switch (scenario.type) {
//       case 'CREDIT_CARD_UNPAID':
//         return await this.handleCreditCardUnpaidDeletion(ap, approvalRequest, executedBy, transaction);
//       case 'CREDIT_CARD_PAID':
//         return await this.handleCreditCardPaidDeletion(ap, approvalRequest, executedBy, transaction);
//       case 'CREDIT_PAYMENT_UNPAID':
//         return await this.handleCreditPaymentUnpaidDeletion(ap, approvalRequest, executedBy, transaction);
//       case 'CREDIT_PAYMENT_PAID':
//         return await this.handleCreditPaymentPaidDeletion(ap, approvalRequest, executedBy, transaction);
//       default:
//         console.warn(`⚠️ [Unknown Scenario] ${scenario.type} - falling back to generic deletion`);
//         return await this.handleGenericAPDeletion(ap, approvalRequest, executedBy, transaction);
//     }
//   }

//   /**
//    * Determine AP deletion scenario based on payment type and status
//    */
//   private determineAPDeletionScenario(ap: AccountsPayable): { type: string; description: string } {
//     const isCardPayment = ap.paymentType === 'CREDIT_CARD' || ap.type === 'CREDIT_CARD_PURCHASE' || ap.type === 'CREDIT_CARD_EXPENSE' || ap.cardId;
//     const isCreditPayment = ap.paymentType === 'CREDIT' || ap.type === 'CREDIT' || ap.type === 'EXPENSE_MANAGEMENT' || ap.type === 'SUPPLIER_CREDIT_EXPENSE';
//     const isPaid = parseFloat(ap.paidAmount.toString()) > 0;

//     console.log(`🔍 [AP Analysis] ${ap.registrationNumber}: paymentType=${ap.paymentType}, type=${ap.type}, cardId=${ap.cardId}, paidAmount=${ap.paidAmount}`);
//     console.log(`🔍 [AP Analysis] isCardPayment=${isCardPayment}, isCreditPayment=${isCreditPayment}, isPaid=${isPaid}`);

//     if (isCardPayment && !isPaid) {
//       return {
//         type: 'CREDIT_CARD_UNPAID',
//         description: 'Credit card payment not yet charged - Simple deletion'
//       };
//     }

//     if (isCardPayment && isPaid) {
//       return {
//         type: 'CREDIT_CARD_PAID',
//         description: 'Credit card payment already charged - Requires card company dispute'
//       };
//     }

//     if (isCreditPayment && !isPaid) {
//       return {
//         type: 'CREDIT_PAYMENT_UNPAID',
//         description: 'Credit payment not yet made - Simple deletion'
//       };
//     }

//     if (isCreditPayment && isPaid) {
//       return {
//         type: 'CREDIT_PAYMENT_PAID',
//         description: 'Credit payment completed - Requires bank reversal and supplier negotiation'
//       };
//     }

//     // Handle other payment types (cash, check, etc.)
//     if (!isPaid) {
//       return {
//         type: 'GENERIC_UNPAID',
//         description: 'Unpaid transaction - Simple deletion'
//       };
//     }

//     return {
//       type: 'GENERIC_PAID',
//       description: 'Paid transaction - Requires reversal handling'
//     };
//   }
//   /**
//    * Scenario 1: Credit Card Purchase - UNPAID
//    * Risk: NONE (no money moved yet - just a liability record)
//    * Action: Simple soft delete using deletion columns
//    */
//   private async handleCreditCardUnpaidDeletion(
//     ap: AccountsPayable,
//     approvalRequest: ApprovalRequest,
//     executedBy: number,
//     transaction: Transaction
//   ): Promise<ReversalOperation[]> {
//     console.log(`💳 [Credit Card Unpaid] Simple deletion for ${ap.registrationNumber} - No financial impact (no money moved yet)`);

//     return [{
//       type: 'SOFT_DELETE',
//       targetTable: 'accounts_payables',
//       targetId: ap.id,
//       data: {
//         deletion_status: 'EXECUTED',
//         deleted_at: new Date(),
//         deleted_by: executedBy,
//         deletion_reason_code: approvalRequest.deletion_reason_code,
//         deletion_memo: approvalRequest.custom_memo || 'Credit card purchase cancelled - No payment made yet',
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 1
//     }];
//   }

//   /**
//    * Scenario 2: Credit Card Purchase - PAID
//    * Risk: HIGH (credit limit used + money sent to supplier)
//    * Action: Restore credit limit + reverse credit card register entry
//    */
//   private async handleCreditCardPaidDeletion(
//     ap: AccountsPayable,
//     approvalRequest: ApprovalRequest,
//     executedBy: number,
//     transaction: Transaction
//   ): Promise<ReversalOperation[]> {
//     console.log(`💳 [Credit Card Paid] Credit limit restoration + AP status reversal required for ${ap.registrationNumber}`);

//     const operations: ReversalOperation[] = [];

//     // 1. Find and reverse the credit card register entry
//     const CreditCardRegister = (await import('../models/CreditCardRegister')).default;
//     const ccEntry = await CreditCardRegister.findOne({
//       where: {
//         relatedDocumentNumber: ap.registrationNumber,
//         transactionType: 'CHARGE',
//         relatedDocumentType: 'Accounts Payable Payment'
//       },
//       transaction
//     });

//     if (ccEntry) {
//       operations.push({
//         type: 'CC_REGISTER_REVERSAL',
//         targetTable: 'credit_card_registers',
//         targetId: ccEntry.id,
//         data: {
//           originalEntry: ccEntry,
//           reversalType: 'REFUND', // Reverse the CHARGE
//           amount: ccEntry.amount,
//           description: `Reversal of credit card payment to ${ap.supplierName} - AP deletion (${approvalRequest.deletion_reason_code})`,
//           deletion_approval_id: approvalRequest.id
//         },
//         priority: 1
//       });
      
//       console.log(`💳 [Credit Card Paid] CC register reversal will automatically restore ${ccEntry.amount} credit for card ${ap.cardId}`);
//     } else {
//       console.warn(`⚠️ [Credit Card Paid] No CC register entry found for ${ap.registrationNumber} - Adding direct credit restoration`);
      
//       // Fallback: If no CC register entry found, restore credit directly
//       if (ap.cardId && parseFloat(ap.paidAmount.toString()) > 0) {
//         operations.push({
//           type: 'RESTORE_CREDIT_LIMIT',
//           targetTable: 'cards',
//           targetId: ap.cardId,
//           data: {
//             restoreAmount: parseFloat(ap.paidAmount.toString()),
//             description: `Credit limit restored for cancelled AP ${ap.registrationNumber} (fallback)`,
//             deletion_approval_id: approvalRequest.id
//           },
//           priority: 1
//         });
//       }
//     }

//     // 2. ✅ NEW: Update related business expense if this AP came from expense management
//     if (ap.type === 'CREDIT_CARD_EXPENSE' && ap.relatedDocumentType === 'Business Expense' && ap.relatedDocumentId) {
//       operations.push({
//         type: 'STATUS_UPDATE',
//         targetTable: 'business_expenses',
//         targetId: ap.relatedDocumentId,
//         data: {
//           payment_status: 'REVERSED',
//           paid_amount: 0,
//           balance_amount: parseFloat(ap.amount.toString()),
//           deletion_status: 'EXECUTED',
//           deleted_at: new Date(),
//           deleted_by: executedBy,
//           deletion_reason_code: approvalRequest.deletion_reason_code,
//           deletion_memo: approvalRequest.custom_memo || `Credit card expense reversed - AP ${ap.registrationNumber}`,
//           deletion_approval_id: approvalRequest.id
//         },
//         priority: 2
//       });
      
//       console.log(`💼 [Business Expense Update] Will update expense ID ${ap.relatedDocumentId} to REVERSED status`);
//     }

//     // 3. Update AP status to REVERSED
//     operations.push({
//       type: 'STATUS_UPDATE',
//       targetTable: 'accounts_payables',
//       targetId: ap.id,
//       data: {
//         status: 'REVERSED',
//         paidAmount: 0,
//         balanceAmount: parseFloat(ap.amount.toString()),
//         paidDate: null,
//         notes: `${ap.notes || ''} | REVERSED: ${approvalRequest.deletion_reason_code}`.trim(),
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 3
//     });

//     // 4. Soft delete the AP (for audit trail)
//     operations.push({
//       type: 'SOFT_DELETE',
//       targetTable: 'accounts_payables',
//       targetId: ap.id,
//       data: {
//         deletion_status: 'EXECUTED',
//         deleted_at: new Date(),
//         deleted_by: executedBy,
//         deletion_reason_code: approvalRequest.deletion_reason_code,
//         deletion_memo: approvalRequest.custom_memo || `Credit card payment reversed - ${ap.supplierName}`,
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 4
//     });

//     console.log(`💳 [Credit Card Paid] Generated ${operations.length} operations for ${ap.registrationNumber}: CC reversal + AP status update + soft delete`);
//     return operations;
//   }
//   /**
//    * Scenario 3: Credit Payment (Bank Transfer) - UNPAID
//    * Risk: LOW (no bank transfer made yet)
//    * Action: Simple soft delete using deletion columns
//    */
//   private async handleCreditPaymentUnpaidDeletion(
//     ap: AccountsPayable,
//     approvalRequest: ApprovalRequest,
//     executedBy: number,
//     transaction: Transaction
//   ): Promise<ReversalOperation[]> {
//     console.log(`🏦 [Credit Payment Unpaid] Simple deletion for ${ap.registrationNumber} - No bank impact`);

//     return [{
//       type: 'SOFT_DELETE',
//       targetTable: 'accounts_payables',
//       targetId: ap.id,
//       data: {
//         deletion_status: 'EXECUTED',
//         deleted_at: new Date(),
//         deleted_by: executedBy,
//         deletion_reason_code: approvalRequest.deletion_reason_code,
//         deletion_memo: approvalRequest.custom_memo || 'Credit payment cancelled before bank transfer',
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 1
//     }];
//   }

//   /**
//    * Scenario 4: Credit Payment (Bank Transfer) - PAID
//    * Risk: MEDIUM-HIGH (bank transfer completed, reversal required)
//    * Action: Bank register reversal + AP reversal + supplier negotiation task
//    */
//   private async handleCreditPaymentPaidDeletion(
//     ap: AccountsPayable,
//     approvalRequest: ApprovalRequest,
//     executedBy: number,
//     transaction: Transaction
//   ): Promise<ReversalOperation[]> {
//     console.log(`🏦 [Credit Payment Paid] Bank reversal + balance restoration required for ${ap.registrationNumber} - Amount: ${ap.paidAmount}`);

//     const operations: ReversalOperation[] = [];

//     // 1. Find related bank register entry (more flexible search)
//     const BankRegister = (await import('../models/BankRegister')).default;
//     const bankEntry = await BankRegister.findOne({
//       where: {
//         relatedDocumentNumber: ap.registrationNumber,
//         relatedDocumentType: 'Accounts Payable Payment'
//       },
//       transaction
//     });

//     if (bankEntry) {
//       console.log(`🏦 [Credit Payment Paid] Found bank entry ${bankEntry.registrationNumber} - Will reverse and restore ${bankEntry.amount} to account ${bankEntry.bankAccountId}`);
      
//       // 2. Create bank register reversal (this will restore bank balance)
//       operations.push({
//         type: 'BANK_REVERSAL',
//         targetTable: 'bank_registers',
//         targetId: bankEntry.id,
//         data: {
//           originalEntry: bankEntry,
//           reversalType: bankEntry.transactionType === 'INFLOW' ? 'OUTFLOW' : 'INFLOW',
//           amount: bankEntry.amount,
//           description: `Reversal of payment to ${ap.supplierName} - AP deletion (${approvalRequest.deletion_reason_code})`,
//           deletion_approval_id: approvalRequest.id,
//           apRegistrationNumber: ap.registrationNumber // Pass AP number for proper reference
//         },
//         priority: 1
//       });

//       // 3. Soft delete original bank entry
//       operations.push({
//         type: 'SOFT_DELETE',
//         targetTable: 'bank_registers',
//         targetId: bankEntry.id,
//         data: {
//           deletion_status: 'EXECUTED',
//           deleted_at: new Date(),
//           deleted_by: executedBy,
//           deletion_reason_code: approvalRequest.deletion_reason_code,
//           deletion_memo: `Bank entry deleted due to AP reversal - ${approvalRequest.custom_memo}`,
//           deletion_approval_id: approvalRequest.id
//         },
//         priority: 2
//       });
//     } else {
//       console.warn(`⚠️ [Credit Payment Paid] No bank entry found for ${ap.registrationNumber} - Payment may have been made through different method`);
//     }

//     // 4. ✅ NEW: Update related business expense if this AP came from expense management
//     if (ap.type === 'SUPPLIER_CREDIT_EXPENSE' && ap.relatedDocumentType === 'Business Expense' && ap.relatedDocumentId) {
//       operations.push({
//         type: 'STATUS_UPDATE',
//         targetTable: 'business_expenses',
//         targetId: ap.relatedDocumentId,
//         data: {
//           payment_status: 'REVERSED',
//           paid_amount: 0,
//           balance_amount: parseFloat(ap.amount.toString()),
//           deletion_status: 'EXECUTED',
//           deleted_at: new Date(),
//           deleted_by: executedBy,
//           deletion_reason_code: approvalRequest.deletion_reason_code,
//           deletion_memo: approvalRequest.custom_memo || `Credit expense reversed - AP ${ap.registrationNumber}`,
//           deletion_approval_id: approvalRequest.id
//         },
//         priority: 3
//       });
      
//       console.log(`💼 [Business Expense Update] Will update expense ID ${ap.relatedDocumentId} to REVERSED status`);
//     }

//     // 5. Update AP status to REVERSED (not just soft delete)
//     operations.push({
//       type: 'STATUS_UPDATE',
//       targetTable: 'accounts_payables',
//       targetId: ap.id,
//       data: {
//         status: 'REVERSED',
//         paidAmount: 0,
//         balanceAmount: parseFloat(ap.amount.toString()),
//         paidDate: null,
//         notes: `${ap.notes || ''} | REVERSED: ${approvalRequest.deletion_reason_code}`.trim(),
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 4
//     });

//     // 6. Soft delete the AP (for audit trail)
//     operations.push({
//       type: 'SOFT_DELETE',
//       targetTable: 'accounts_payables',
//       targetId: ap.id,
//       data: {
//         deletion_status: 'EXECUTED',
//         deleted_at: new Date(),
//         deleted_by: executedBy,
//         deletion_reason_code: approvalRequest.deletion_reason_code,
//         deletion_memo: approvalRequest.custom_memo || `Credit payment reversed - ${ap.supplierName}`,
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 5
//     });

//     console.log(`🏦 [Credit Payment Paid] Generated ${operations.length} operations for ${ap.registrationNumber}`);
//     return operations;
//   }
//   /**
//    * Generic AP deletion for unknown scenarios
//    */
//   private async handleGenericAPDeletion(
//     ap: AccountsPayable,
//     approvalRequest: ApprovalRequest,
//     executedBy: number,
//     transaction: Transaction
//   ): Promise<ReversalOperation[]> {
//     console.log(`❓ [Generic AP] Fallback deletion for ${ap.registrationNumber}`);

//     const operations: ReversalOperation[] = [];
//     const paidAmount = parseFloat(ap.paidAmount.toString());

//     // If paid, try to find and reverse related entries
//     if (paidAmount > 0) {
//       // Find bank register entries
//       const bankEntries = await BankRegister.findAll({
//         where: { 
//           relatedDocumentNumber: ap.registrationNumber,
//           relatedDocumentType: 'Accounts Payable Payment'
//         },
//         transaction
//       });

//       // Create bank reversal operations
//       for (const bankEntry of bankEntries) {
//         operations.push({
//           type: 'BANK_REVERSAL',
//           targetTable: 'bank_registers',
//           targetId: bankEntry.id,
//           data: {
//             originalEntry: bankEntry,
//             reversalType: bankEntry.transactionType === 'OUTFLOW' ? 'INFLOW' : 'OUTFLOW',
//             amount: bankEntry.amount,
//             description: `Generic reversal of AP payment ${ap.registrationNumber}`,
//             deletion_approval_id: approvalRequest.id
//           },
//           priority: 1
//         });
//       }
//     }

//     // Soft delete the AP record
//     operations.push({
//       type: 'SOFT_DELETE',
//       targetTable: 'accounts_payables',
//       targetId: ap.id,
//       data: {
//         deletion_status: 'EXECUTED',
//         deleted_at: new Date(),
//         deleted_by: executedBy,
//         deletion_reason_code: approvalRequest.deletion_reason_code,
//         deletion_memo: approvalRequest.custom_memo || 'Generic AP deletion',
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 2
//     });

//     return operations;
//   }
//   /**
//    * ✅ UPDATED: Generate AR reversal operations based on payment status and method
//    * 
//    * Scenarios:
//    * 1. AR Credit (Unpaid) → Simple soft delete only
//    * 2. AR Credit (Paid) → Check payment method and reverse accordingly:
//    *    - Cash → Update Cash Register Master (reduce store balance)
//    *    - Bank/Cheque/Deposit/Debit → Update Bank Account (reduce bank balance)
//    */
//   private async generateARReversalOperations(
//     node: TransactionNode,
//     approvalRequest: ApprovalRequest,
//     executedBy: number,
//     transaction: Transaction
//   ): Promise<ReversalOperation[]> {
//     const operations: ReversalOperation[] = [];
    
//     const ar = await AccountsReceivable.findByPk(node.id, { transaction });
//     if (!ar) return operations;
    
//     const receivedAmount = parseFloat(ar.receivedAmount?.toString() || '0');
    
//     console.log(`� [AR Analysis] ${ar.registrationNumber}: Total=${ar.amount}, Received=${receivedAmount}, Status=${ar.status}`);
    
//     // ✅ Scenario 1: AR Credit (Unpaid) - Simple soft delete only
//     if (receivedAmount === 0) {
//       console.log(`📋 [AR Unpaid] Simple deletion - no payment reversals needed`);
      
//       // Just soft delete the AR record
//       operations.push({
//         type: 'SOFT_DELETE',
//         targetTable: 'accounts_receivables',
//         targetId: ar.id,
//         data: {
//           deletion_status: 'EXECUTED',
//           deleted_at: new Date(),
//           deleted_by: executedBy,
//           deletion_reason_code: approvalRequest.deletion_reason_code,
//           deletion_memo: approvalRequest.custom_memo,
//           deletion_approval_id: approvalRequest.id
//         },
//         priority: 1
//       });
      
//       return operations;
//     }
    
//     // ✅ Scenario 2: AR Credit (Paid) - Check payment method and reverse accordingly
//     console.log(`💰 [AR Paid] AR has been collected ${receivedAmount}. Checking payment methods...`);
    
//     // Find all related cash register entries (CASH payments)
//     const cashEntries = await CashRegister.findAll({
//       where: { 
//         relatedDocumentNumber: ar.registrationNumber,
//         deletion_status: { [Op.ne]: 'EXECUTED' }
//       },
//       transaction
//     });
    
//     // Find all related bank register entries (BANK/CHEQUE/DEPOSIT/DEBIT payments)
//     const bankEntries = await BankRegister.findAll({
//       where: { 
//         relatedDocumentNumber: ar.registrationNumber,
//         deletion_status: { [Op.ne]: 'EXECUTED' }
//       },
//       transaction
//     });
    
//     // ✅ Handle CASH payments - Update Cash Register Master (reduce store balance)
//     for (const cashEntry of cashEntries) {
//       console.log(`💵 [AR Cash Reversal] Found cash payment: ${cashEntry.registrationNumber} (${cashEntry.transactionType} ${cashEntry.amount})`);
      
//       operations.push({
//         type: 'CASH_REVERSAL',
//         targetTable: 'cash_registers',
//         targetId: cashEntry.id,
//         data: {
//           originalEntry: cashEntry,
//           reversalType: cashEntry.transactionType === 'INFLOW' ? 'OUTFLOW' : 'INFLOW',
//           amount: cashEntry.amount,
//           description: `Reversal of AR collection ${ar.registrationNumber} - ${ar.clientName || 'Customer'} (${approvalRequest.deletion_reason_code})`,
//           deletion_approval_id: approvalRequest.id
//         },
//         priority: 1
//       });
//     }
    
//     // ✅ Handle BANK payments - Update Bank Account (reduce bank balance)
//     for (const bankEntry of bankEntries) {
//       console.log(`🏦 [AR Bank Reversal] Found bank payment: ${bankEntry.registrationNumber} (${bankEntry.transactionType} ${bankEntry.amount}) - Method: ${bankEntry.paymentMethod}`);
      
//       operations.push({
//         type: 'BANK_REVERSAL',
//         targetTable: 'bank_registers',
//         targetId: bankEntry.id,
//         data: {
//           originalEntry: bankEntry,
//           reversalType: bankEntry.transactionType === 'INFLOW' ? 'OUTFLOW' : 'INFLOW',
//           amount: bankEntry.amount,
//           description: `Reversal of AR collection ${ar.registrationNumber} - ${ar.clientName || 'Customer'} (${approvalRequest.deletion_reason_code})`,
//           deletion_approval_id: approvalRequest.id
//         },
//         priority: 1
//       });
//     }
    
//     // Reset AR collection status
//     operations.push({
//       type: 'STATUS_UPDATE',
//       targetTable: 'accounts_receivables',
//       targetId: ar.id,
//       data: {
//         receivedAmount: 0,
//         balanceAmount: parseFloat(ar.amount.toString()),
//         status: 'Not Collected'
//       },
//       priority: 2
//     });
    
//     // Soft delete the AR record
//     operations.push({
//       type: 'SOFT_DELETE',
//       targetTable: 'accounts_receivables',
//       targetId: ar.id,
//       data: {
//         deletion_status: 'EXECUTED',
//         deleted_at: new Date(),
//         deleted_by: executedBy,
//         deletion_reason_code: approvalRequest.deletion_reason_code,
//         deletion_memo: approvalRequest.custom_memo,
//         deletion_approval_id: approvalRequest.id
//       },
//       priority: 3
//     });
    
//     console.log(`✅ [AR Operations] Generated ${operations.length} operations for AR ${ar.registrationNumber}`);
//     return operations;
//   }
//   /**
//    * Execute batch operations with optimized performance
//    * 
//    * Algorithm: Priority-based execution with batch processing
//    * Time Complexity: O(n log n) for sorting + O(n) for execution
//    */
//   private async executeBatchOperations(
//     operations: ReversalOperation[],
//     transaction: Transaction
//   ): Promise<void> {
//     console.log(`🚀 [Batch Execution] Processing ${operations.length} operations...`);
    
//     // Sort operations by priority (lower number = higher priority)
//     operations.sort((a, b) => a.priority - b.priority);
    
//     // Group operations by type for batch processing
//     const operationGroups = new Map<string, ReversalOperation[]>();
    
//     for (const op of operations) {
//       const key = op.type;
//       if (!operationGroups.has(key)) {
//         operationGroups.set(key, []);
//       }
//       operationGroups.get(key)!.push(op);
//     }
    
//     // Execute operations in priority order
//     for (const [type, ops] of operationGroups) {
//       console.log(`📋 [${type}] Executing ${ops.length} operations...`);
      
//       switch (type) {
//         case 'BANK_REVERSAL':
//           await this.executeBankReversalBatch(ops, transaction);
//           break;
//         case 'CASH_REVERSAL':
//           await this.executeCashReversalBatch(ops, transaction);
//           break;
//         case 'CC_REGISTER_REVERSAL':
//           await this.executeCCRegisterReversalBatch(ops, transaction);
//           break;
//         case 'STATUS_UPDATE':
//           await this.executeStatusUpdateBatch(ops, transaction);
//           break;
//         case 'SOFT_DELETE':
//           await this.executeSoftDeleteBatch(ops, transaction);
//           break;
//         case 'CREATE_REVERSAL_AP':
//           await this.executeCreateReversalAPBatch(ops, transaction);
//           break;
//         case 'CREATE_MANUAL_TASK':
//           await this.executeCreateManualTaskBatch(ops, transaction);
//           break;
//         case 'RESTORE_CREDIT_LIMIT':
//           await this.executeRestoreCreditLimitBatch(ops, transaction);
//           break;
//         case 'BANK_BALANCE_UPDATE':
//           await this.executeBankBalanceUpdateBatch(ops, transaction);
//           break;
//       }
//     }
    
//     console.log(`✅ [Batch Complete] All ${operations.length} operations executed successfully`);
//   }
//   /**
//    * Execute bank reversal operations in batch
//    */
//   private async executeBankReversalBatch(
//     operations: ReversalOperation[],
//     transaction: Transaction
//   ): Promise<void> {
//     for (const op of operations) {
//       const { originalEntry, reversalType, amount, description, deletion_approval_id, apRegistrationNumber } = op.data;
      
//       const reversalNumber = await this.generateReversalNumber('BRREV', transaction);
      
//       // Create reversal entry in bank register
//       await BankRegister.create({
//         registrationNumber: reversalNumber,
//         registrationDate: new Date(),
//         transactionType: reversalType,
//         sourceTransactionType: 'ADJUSTMENT',
//         amount: amount,
//         paymentMethod: originalEntry.paymentMethod,
//         relatedDocumentType: 'REVERSAL',
//         relatedDocumentNumber: apRegistrationNumber || originalEntry.relatedDocumentNumber, // Use AP number if provided
//         clientRnc: originalEntry.clientRnc,
//         clientName: originalEntry.clientName,
//         supplierName: originalEntry.supplierName,
//         supplierRnc: originalEntry.supplierRnc,
//         ncf: originalEntry.ncf,
//         description: description,
//         bankAccountId: originalEntry.bankAccountId,
//         is_reversal: true,
//         original_transaction_id: originalEntry.id,
//         deletion_approval_id: deletion_approval_id
//       }, { transaction });
      
//       // ✅ CRITICAL FIX: Update bank account balance
//       if (originalEntry.bankAccountId) {
//         await this.updateBankAccountBalance(
//           originalEntry.bankAccountId,
//           amount,
//           reversalType,
//           transaction
//         );
//       }
      
//       console.log(`🏦 [Bank Reversal] Created ${reversalNumber} (${reversalType} ${amount}) for AP ${apRegistrationNumber || originalEntry.relatedDocumentNumber} + Updated bank balance`);
//     }
//   }

//   /**
//    * Execute credit card register reversal operations in batch
//    */
//   private async executeCCRegisterReversalBatch(
//     operations: ReversalOperation[],
//     transaction: Transaction
//   ): Promise<void> {
//     const creditCardRegisterService = (await import('./creditCardRegisterService')).default;
    
//     for (const op of operations) {
//       const { originalEntry, reversalType, amount, description, deletion_approval_id } = op.data;
      
//       console.log(`💳 [CC Reversal Start] Processing reversal for ${originalEntry.registrationNumber} - Amount: ${amount}`);
      
//       // Use the credit card register service to process the refund
//       const refundData = {
//         cardId: originalEntry.cardId,
//         amount: amount,
//         relatedDocumentType: 'REVERSAL',
//         relatedDocumentNumber: originalEntry.registrationNumber,
//         description: description,
//         originalTransactionId: originalEntry.id,
//         notes: `Reversal due to AP deletion - Approval ID: ${deletion_approval_id}`
//       };
      
//       // Execute the refund within the existing transaction context
//       const refundEntry = await creditCardRegisterService.processCreditCardRefund(refundData, transaction);
      
//       console.log(`💳 [CC Reversal Complete] Created refund ${refundEntry.registrationNumber} (${reversalType} ${amount}) + Restored credit limit`);
//     }
//   }

//   /**
//    * Execute cash reversal operations in batch
//    */
//   private async executeCashReversalBatch(
//     operations: ReversalOperation[],
//     transaction: Transaction
//   ): Promise<void> {
//     const CashRegisterMaster = (await import('../models/CashRegisterMaster')).default;
    
//     for (const op of operations) {
//       const { originalEntry, reversalType, amount, description, deletion_approval_id } = op.data;
      
//       const reversalNumber = await this.generateReversalNumber('CR', transaction);
      
//       // Create reversal entry
//       await CashRegister.create({
//         registrationNumber: reversalNumber,
//         registrationDate: new Date(),
//         transactionType: reversalType,
//         amount: amount,
//         paymentMethod: originalEntry.paymentMethod,
//         relatedDocumentType: 'REVERSAL',
//         relatedDocumentNumber: originalEntry.registrationNumber,
//         clientRnc: originalEntry.clientRnc,
//         clientName: originalEntry.clientName,
//         ncf: originalEntry.ncf,
//         description: description,
//         balance: 0,
//         cashRegisterId: originalEntry.cashRegisterId,
//         bankAccountId: originalEntry.bankAccountId,
//         is_reversal: true,
//         original_transaction_id: originalEntry.id,
//         deletion_approval_id: deletion_approval_id
//       }, { transaction });
      
//       // ✅ FIX: Update Cash Register Master balance ONLY ONCE for the deletion
//       // The reversal undoes the original transaction's effect on the store balance
//       if (originalEntry.cashRegisterId) {
//         const cashRegisterMaster = await CashRegisterMaster.findByPk(originalEntry.cashRegisterId, { transaction });
//         if (cashRegisterMaster) {
//           const currentBalance = parseFloat(cashRegisterMaster.balance.toString());
          
//           // Calculate the net effect of deleting the original transaction
//           // If original was INFLOW, we need to REMOVE that money from store (decrease balance)
//           // If original was OUTFLOW, we need to ADD that money back to store (increase balance)
//           const originalAmount = parseFloat(originalEntry.amount.toString());
//           const balanceAdjustment = originalEntry.transactionType === 'INFLOW' ? -originalAmount : originalAmount;
//           const newBalance = currentBalance + balanceAdjustment;
          
//           await cashRegisterMaster.update({ balance: newBalance }, { transaction });
          
//           console.log(`🏪 [Cash Master Deletion] Store "${cashRegisterMaster.name}": ${currentBalance} → ${newBalance} (${balanceAdjustment > 0 ? '+' : ''}${balanceAdjustment}) - Deleted ${originalEntry.transactionType} ${originalAmount}`);
//         }
//       }
      
//       console.log(`💰 [Cash Reversal] Created ${reversalNumber} (${reversalType} ${amount})`);
//     }
//   }
//   /**
//    * Execute status update operations in batch
//    */
//   private async executeStatusUpdateBatch(
//     operations: ReversalOperation[],
//     transaction: Transaction
//   ): Promise<void> {
//     for (const op of operations) {
//       const model = await this.getModelByTableName(op.targetTable);
//       if (model) {
//         await model.update(op.data, {
//           where: { id: op.targetId },
//           transaction
//         });
//         console.log(`📝 [Status Update] Updated ${op.targetTable} ID ${op.targetId}`);
//       }
//     }
//   }

//   /**
//    * Execute soft delete operations in batch
//    */
//   private async executeSoftDeleteBatch(
//     operations: ReversalOperation[],
//     transaction: Transaction
//   ): Promise<void> {
//     for (const op of operations) {
//       const model = await this.getModelByTableName(op.targetTable);
//       if (model) {
//         try {
//           let updateResult;
//           if (op.data.relatedDocumentNumber) {
//             // Update by related document number
//             updateResult = await model.update(op.data, {
//               where: { relatedDocumentNumber: op.data.relatedDocumentNumber },
//               transaction
//             });
//             console.log(`🗑️ [Soft Delete] Deleted ${op.targetTable} by document ${op.data.relatedDocumentNumber} - Affected rows: ${updateResult[0]}`);
//           } else {
//             // Update by ID
//             updateResult = await model.update(op.data, {
//               where: { id: op.targetId },
//               transaction
//             });
//             console.log(`🗑️ [Soft Delete] Deleted ${op.targetTable} ID ${op.targetId} - Affected rows: ${updateResult[0]}`);
//           }
          
//           // Check if any rows were actually updated
//           if (updateResult[0] === 0) {
//             console.warn(`⚠️ [Soft Delete Warning] No rows updated for ${op.targetTable} ID ${op.targetId}`);
//           }
//         } catch (error) {
//           console.error(`❌ [Soft Delete Error] Failed to delete ${op.targetTable} ID ${op.targetId}:`, error);
//           throw error;
//         }
//       } else {
//         console.error(`❌ [Model Error] No model found for table: ${op.targetTable}`);
//       }
//     }
//   }

//   /**
//    * Get Sequelize model by table name
//    */
//   private async getModelByTableName(tableName: string): Promise<any> {
//     switch (tableName) {
//       case 'purchases': return Purchase;
//       case 'business_expenses': 
//         return (await import('../models/BusinessExpense')).default;
//       case 'sales': return Sale;
//       case 'bank_registers': return BankRegister;
//       case 'cash_registers': return CashRegister;
//       case 'accounts_payables': return AccountsPayable;
//       case 'accounts_receivables': return AccountsReceivable;
//       default: return null;
//     }
//   }
//   /**
//    * Execute restore credit limit operations in batch
//    */
//   private async executeRestoreCreditLimitBatch(
//     operations: ReversalOperation[],
//     transaction: Transaction
//   ): Promise<void> {
//     const Card = (await import('../models/Card')).default;
    
//     for (const op of operations) {
//       const { restoreAmount, description } = op.data;
      
//       const card = await Card.findByPk(op.targetId, { transaction });
//       if (card && card.cardType === 'CREDIT') {
//         const currentUsedCredit = parseFloat(card.usedCredit.toString() || '0');
//         const newUsedCredit = Math.max(0, currentUsedCredit - restoreAmount);
        
//         await card.update({ usedCredit: newUsedCredit }, { transaction });
        
//         console.log(`💳 [Credit Restored] Card ${card.cardBrand} ****${card.cardNumberLast4}: Used credit ${currentUsedCredit} → ${newUsedCredit} (Restored: ${restoreAmount})`);
//       } else {
//         console.warn(`⚠️ [Credit Restore] Card ${op.targetId} not found or not a credit card`);
//       }
//     }
//   }

//   /**
//    * Execute create reversal AP operations in batch
//    */
//   private async executeCreateReversalAPBatch(
//     operations: ReversalOperation[],
//     transaction: Transaction
//   ): Promise<void> {
//     for (const op of operations) {
//       const reversalAP = await AccountsPayable.create(op.data, { transaction });
      
//       // Update the original AP record with reversal_transaction_id
//       if (op.data.original_transaction_id) {
//         await AccountsPayable.update({
//           reversal_transaction_id: reversalAP.id
//         }, {
//           where: { id: op.data.original_transaction_id },
//           transaction
//         });
//       }
      
//       console.log(`🔄 [AP Reversal] Created reversal AP ${reversalAP.registrationNumber} for original ${op.data.original_transaction_id}`);
//     }
//   }

//   /**
//    * Execute create manual task operations in batch
//    */
//   private async executeCreateManualTaskBatch(
//     operations: ReversalOperation[],
//     transaction: Transaction
//   ): Promise<void> {
//     for (const op of operations) {
//       // For now, just log the manual task creation
//       // In a real implementation, you would integrate with your task management system
//       console.log(`📋 [Manual Task] ${op.data.task_type}: ${op.data.title}`);
//       console.log(`   Description: ${op.data.description}`);
//       console.log(`   Assigned to: ${op.data.assigned_to}`);
//       console.log(`   Priority: ${op.data.priority}`);
//       console.log(`   Due: ${op.data.due_date}`);
      
//       // TODO: Implement actual task creation
//       // await TaskManager.create(op.data, { transaction });
      
//       // For demonstration, create a simple log entry
//       await this.createAuditTrailEntry({
//         entity_type: op.data.entity_type,
//         entity_id: op.data.entity_id,
//         action_type: 'MANUAL_TASK_CREATED',
//         action_data: {
//           task_type: op.data.task_type,
//           title: op.data.title,
//           description: op.data.description,
//           assigned_to: op.data.assigned_to,
//           priority: op.data.priority,
//           due_date: op.data.due_date
//         },
//         user_id: 1, // System user
//         approval_id: op.data.deletion_approval_id || null
//       }, transaction);
//     }
//   }
//   /**
//    * Validate approval request
//    */
//   private async validateApprovalRequest(
//     approvalRequestId: number,
//     transaction: Transaction
//   ): Promise<ApprovalRequest> {
//     const approvalRequest = await ApprovalRequest.findByPk(approvalRequestId, { transaction });

//     if (!approvalRequest) {
//       throw new NotFoundError(`Approval request with ID ${approvalRequestId} not found`);
//     }

//     if (approvalRequest.status !== 'Approved') {
//       throw new BusinessLogicError(`Approval request is not in approved status`);
//     }

//     if (approvalRequest.executed_at) {
//       throw new BusinessLogicError(`Approval request has already been executed`);
//     }

//     return approvalRequest;
//   }

//   /**
//    * Finalize execution with audit trail
//    */
//   private async finalizeExecution(
//     approvalRequest: ApprovalRequest,
//     data: ExecuteDeletionData,
//     transaction: Transaction
//   ): Promise<void> {
//     // Mark approval request as executed
//     await approvalRequest.update({
//       executed_at: new Date()
//     }, { transaction });

//     // Create final audit trail entry
//     await this.createAuditTrailEntry({
//       entity_type: approvalRequest.entity_type,
//       entity_id: approvalRequest.entity_id,
//       action_type: 'DELETION_EXECUTED',
//       action_data: {
//         approval_request_id: data.approvalRequestId,
//         executed_by: data.executedBy,
//         deletion_reason: approvalRequest.deletion_reason_code,
//         custom_memo: approvalRequest.custom_memo
//       },
//       user_id: data.executedBy,
//       ip_address: data.ipAddress,
//       user_agent: data.userAgent,
//       approval_id: approvalRequest.id
//     }, transaction);
//   }
//   /**
//    * Generate reversal transaction number
//    */
//   private async generateReversalNumber(prefix: string, transaction: Transaction): Promise<string> {
//     const today = new Date();
//     const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
//     // Find last reversal number for today
//     let lastReversal: any = null;
    
//     if (prefix === 'BR') {
//       lastReversal = await BankRegister.findOne({
//         where: {
//           registrationNumber: {
//             [Op.like]: `${prefix}REV${dateStr}%`
//           }
//         },
//         order: [['id', 'DESC']],
//         transaction
//       });
//     } else {
//       lastReversal = await CashRegister.findOne({
//         where: {
//           registrationNumber: {
//             [Op.like]: `${prefix}REV${dateStr}%`
//           }
//         },
//         order: [['id', 'DESC']],
//         transaction
//       });
//     }

//     let nextNumber = 1;
//     if (lastReversal) {
//       const lastNumberStr = lastReversal.registrationNumber.substring(`${prefix}REV${dateStr}`.length);
//       nextNumber = parseInt(lastNumberStr) + 1;
//     }

//     return `${prefix}REV${dateStr}${String(nextNumber).padStart(3, '0')}`;
//   }

//   /**
//    * Update bank account balance when creating reversal entries
//    */
//   private async updateBankAccountBalance(
//     bankAccountId: number,
//     amount: number,
//     transactionType: 'INFLOW' | 'OUTFLOW',
//     transaction: Transaction
//   ): Promise<void> {
//     const bankAccount = await BankAccount.findByPk(bankAccountId, { transaction });
    
//     if (!bankAccount) {
//       console.warn(`⚠️ [Bank Account] Bank account ${bankAccountId} not found, skipping balance update`);
//       return;
//     }
    
//     const currentBalance = parseFloat(bankAccount.balance.toString());
//     const transactionAmount = parseFloat(amount.toString());
    
//     // For reversal entries: INFLOW increases balance, OUTFLOW decreases balance
//     const newBalance = transactionType === 'INFLOW' 
//       ? currentBalance + transactionAmount
//       : currentBalance - transactionAmount;
    
//     await bankAccount.update({ balance: newBalance }, { transaction });
    
//     console.log(`💰 [Bank Balance] Updated ${bankAccount.bankName} (${bankAccount.accountNumber}): ${currentBalance} → ${newBalance} (${transactionType} ${transactionAmount})`);
//   }

//   private async executeBankBalanceUpdateBatch(
//     operations: ReversalOperation[],
//     transaction: Transaction
//   ): Promise<void> {
//     for (const op of operations) {
//       const { amount, transactionType, description } = op.data;
      
//       await this.updateBankAccountBalance(
//         op.targetId,
//         amount,
//         transactionType,
//         transaction
//       );
      
//       console.log(`💰 [Bank Balance Update] Account ${op.targetId}: ${transactionType} ${amount} - ${description}`);
//     }
//   }

//   private async createAuditTrailEntry(data: {
//     entity_type: string;
//     entity_id: number;
//     action_type: string;
//     action_data: any;
//     user_id: number;
//     ip_address?: string;
//     user_agent?: string;
//     approval_id?: number;
//   }, transaction: Transaction): Promise<void> {
//     // Get previous hash for chain
//     const lastAudit = await TransactionAuditTrail.findOne({
//       order: [['id', 'DESC']],
//       transaction
//     });

//     // Create hash of current entry
//     const entryData = JSON.stringify({
//       ...data,
//       timestamp: new Date().toISOString()
//     });
    
//     const currentHash = crypto
//       .createHash('sha256')
//       .update(entryData + (lastAudit?.audit_hash || ''))
//       .digest('hex');

//     await TransactionAuditTrail.create({
//       audit_hash: currentHash,
//       previous_hash: lastAudit?.audit_hash,
//       entity_type: data.entity_type,
//       entity_id: data.entity_id,
//       action_type: data.action_type,
//       action_data: data.action_data,
//       user_id: data.user_id,
//       ip_address: data.ip_address,
//       user_agent: data.user_agent,
//       approval_id: data.approval_id
//     }, { transaction });
//   }
// }

// export default TransactionDeletionService;
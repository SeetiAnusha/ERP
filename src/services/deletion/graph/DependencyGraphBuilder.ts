/**
 * Dependency Graph Builder for Transaction Deletions
 * 
 * Extracted from TransactionDeletionService to improve maintainability
 * Handles dependency graph building using BFS traversal and topological sorting
 */

import { Transaction, Op } from 'sequelize';
import Purchase from '../../../models/Purchase';
import Sale from '../../../models/Sale';
import AccountsPayable from '../../../models/AccountsPayable';
import AccountsReceivable from '../../../models/AccountsReceivable';
import BankRegister from '../../../models/BankRegister';
import CashRegister from '../../../models/CashRegister';
import BusinessExpense from '../../../models/BusinessExpense';
import { BaseService } from '../../../core/BaseService';

interface TransactionNode {
  id: number;
  type: 'PURCHASE' | 'SALE' | 'PAYMENT' | 'BANK_REGISTER' | 'CASH_REGISTER' | 'AP' | 'AR' | 'BUSINESS_EXPENSE';
  registrationNumber: string;
  amount: number;
  status: string;
  dependencies: TransactionNode[];
  dependents: TransactionNode[];
  processed: boolean;
  entityType?: string;
}

export class DependencyGraphBuilder extends BaseService {

  /**
   * Build transaction dependency graph using BFS traversal
   * 
   * Algorithm: Breadth-First Search to discover all related transactions
   * Time Complexity: O(V + E)
   * EXACT COPY from TransactionDeletionService
   */
  async buildTransactionDependencyGraph(
    entityType: string, 
    entityId: number, 
    transaction: Transaction
  ): Promise<{ nodes: TransactionNode[], edges: Array<{from: number, to: number}>, sortedNodes: TransactionNode[] }> {
    const nodes: Map<string, TransactionNode> = new Map();
    const edges: Array<{from: number, to: number}> = [];
    const visited: Set<string> = new Set();
    const queue: Array<{type: string, id: number}> = [];
    
    console.log(`🔍 [Graph Building] Starting with entity: ${entityType} ID ${entityId}`);
    
    // Start BFS from root entity
    queue.push({ type: entityType.toUpperCase(), id: entityId });
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const nodeKey = `${current.type}_${current.id}`;
      
      console.log(`🔍 [Graph Building] Processing: ${nodeKey}`);
      
      if (visited.has(nodeKey)) continue;
      visited.add(nodeKey);
      
      // Discover node and its relationships
      const nodeData = await this.discoverTransactionNode(current.type, current.id, transaction);
      if (nodeData) {
        console.log(`✅ [Graph Building] Found node: ${nodeData.type} ${nodeData.id} (${nodeData.registrationNumber})`);
        nodes.set(nodeKey, nodeData);
        
        // Discover related transactions (payments, registers, etc.)
        const relatedTransactions = await this.discoverRelatedTransactions(nodeData, transaction);
        console.log(`🔗 [Graph Building] Found ${relatedTransactions.length} related transactions for ${nodeKey}`);
        
        for (const related of relatedTransactions) {
          const relatedKey = `${related.type}_${related.id}`;
          if (!visited.has(relatedKey)) {
            queue.push({ type: related.type, id: related.id });
            edges.push({ from: current.id, to: related.id });
          }
        }
      } else {
        console.warn(`⚠️ [Graph Building] No node data found for: ${nodeKey}`);
      }
    }
    
    console.log(`📊 [Graph Building] Final graph: ${nodes.size} nodes, ${edges.length} edges`);
    
    // Perform topological sort for deletion order
    const sortedNodes = this.topologicalSort({ nodes: Array.from(nodes.values()), edges });
    
    return { 
      nodes: Array.from(nodes.values()), 
      edges,
      sortedNodes 
    };
  }

  /**
   * Discover transaction node with all its properties
   * 
   * Polymorphic method handling all transaction types
   * EXACT COPY from TransactionDeletionService
   */
  private async discoverTransactionNode(
    type: string, 
    id: number, 
    transaction: Transaction
  ): Promise<TransactionNode | null> {
    let entity: any = null;
    let amount = 0;
    let status = '';
    let registrationNumber = '';
    
    console.log(`🔍 [Node Discovery] Looking for ${type.toLowerCase()} with ID ${id}`);
    
    switch (type.toLowerCase()) {
      case 'purchase':
        entity = await Purchase.findByPk(id, { transaction });
        if (entity) {
          amount = parseFloat(entity.total.toString());
          status = entity.paymentStatus;
          registrationNumber = entity.registrationNumber;
        }
        break;
        
      case 'sale':
        entity = await Sale.findByPk(id, { transaction });
        if (entity) {
          amount = parseFloat(entity.total.toString());
          status = entity.paymentStatus || 'Unknown';
          registrationNumber = entity.registrationNumber;
        }
        break;
        
      case 'business_expense':
      case 'businessexpense':
        entity = await BusinessExpense.findByPk(id, { transaction });
        if (entity) {
          amount = parseFloat(entity.amount.toString());
          status = entity.paymentStatus || 'Unknown';
          registrationNumber = entity.registrationNumber;
        }
        break;
        
      case 'ap':
      case 'accountspayable':
      case 'accounts_payable':
        entity = await AccountsPayable.findByPk(id, { transaction });
        if (entity) {
          amount = parseFloat(entity.amount.toString());
          status = entity.status;
          registrationNumber = entity.registrationNumber;
        }
        break;
        
      case 'ar':
      case 'accountsreceivable':
      case 'accounts_receivable':
        entity = await AccountsReceivable.findByPk(id, { transaction });
        if (entity) {
          amount = parseFloat(entity.amount.toString());
          status = entity.status;
          registrationNumber = entity.registrationNumber;
        }
        break;
        
      case 'bank_register':
      case 'bankregister':
        entity = await BankRegister.findByPk(id, { transaction });
        if (entity) {
          amount = parseFloat(entity.amount.toString());
          status = 'Active';
          registrationNumber = entity.registrationNumber;
        }
        break;
        
      case 'cash_register':
      case 'cashregister':
        entity = await CashRegister.findByPk(id, { transaction });
        if (entity) {
          amount = parseFloat(entity.amount.toString());
          status = 'Active';
          registrationNumber = entity.registrationNumber;
        }
        break;
    }
    
    if (!entity) {
      console.warn(`⚠️ [Node Discovery] Entity not found: ${type} ID ${id}`);
      return null;
    }
    
    console.log(`✅ [Node Discovery] Found ${type}: ${registrationNumber} (Amount: ${amount}, Status: ${status})`);

    let normalizedType = type.toUpperCase();
    if (normalizedType === 'ACCOUNTSPAYABLE' || normalizedType === 'ACCOUNTS_PAYABLE') {
      normalizedType = 'AP';
    } else if (normalizedType === 'ACCOUNTSRECEIVABLE' || normalizedType === 'ACCOUNTS_RECEIVABLE') {
      normalizedType = 'AR';
    } else if (normalizedType === 'BUSINESSEXPENSE') {
      normalizedType = 'BUSINESS_EXPENSE';
    } else if (normalizedType === 'BANKREGISTER') {  // ✅ FIX: Normalize BANKREGISTER to BANK_REGISTER
      normalizedType = 'BANK_REGISTER';
    } else if (normalizedType === 'CASHREGISTER') {  // ✅ FIX: Normalize CASHREGISTER to CASH_REGISTER
      normalizedType = 'CASH_REGISTER';
    }
    
    return {
      id,
      type: normalizedType as any,
      registrationNumber,
      amount,
      status,
      dependencies: [],
      dependents: [],
      processed: false,
      entityType: type
    };
  }

  /**
   * Discover related transactions using optimized queries
   * 
   * Uses indexed queries for O(log n) lookup performance
   * EXACT COPY from TransactionDeletionService
   */
  private async discoverRelatedTransactions(
    node: TransactionNode, 
    transaction: Transaction
  ): Promise<Array<{type: string, id: number}>> {
    const related: Array<{type: string, id: number}> = [];
    
    switch (node.type) {
      case 'PURCHASE':
        // Find related AP records
        const apRecords = await AccountsPayable.findAll({
          where: { relatedDocumentNumber: node.registrationNumber },
          attributes: ['id'],
          transaction
        });
        related.push(...apRecords.map(ap => ({ type: 'AP', id: ap.id })));
        
        // Find related bank/cash register entries
        const bankEntries = await BankRegister.findAll({
          where: { relatedDocumentNumber: node.registrationNumber },
          attributes: ['id'],
          transaction
        });
        related.push(...bankEntries.map(br => ({ type: 'BANK_REGISTER', id: br.id })));
        
        const cashEntries = await CashRegister.findAll({
          where: { relatedDocumentNumber: node.registrationNumber },
          attributes: ['id'],
          transaction
        });
        related.push(...cashEntries.map(cr => ({ type: 'CASH_REGISTER', id: cr.id })));
        break;
        
      case 'BUSINESS_EXPENSE':
        // Find related AP records for business expenses
        const expenseAPRecords = await AccountsPayable.findAll({
          where: { relatedDocumentNumber: node.registrationNumber },
          attributes: ['id'],
          transaction
        });
        related.push(...expenseAPRecords.map(ap => ({ type: 'AP', id: ap.id })));
        
        // Find related bank/cash register entries for business expenses
        const expenseBankEntries = await BankRegister.findAll({
          where: { relatedDocumentNumber: node.registrationNumber },
          attributes: ['id'],
          transaction
        });
        related.push(...expenseBankEntries.map(br => ({ type: 'BANK_REGISTER', id: br.id })));
        
        const expenseCashEntries = await CashRegister.findAll({
          where: { relatedDocumentNumber: node.registrationNumber },
          attributes: ['id'],
          transaction
        });
        related.push(...expenseCashEntries.map(cr => ({ type: 'CASH_REGISTER', id: cr.id })));
        break;
        
      case 'SALE':
        // Find related AR records
        const arRecords = await AccountsReceivable.findAll({
          where: { relatedDocumentNumber: node.registrationNumber },
          attributes: ['id'],
          transaction
        });
        related.push(...arRecords.map(ar => ({ type: 'AR', id: ar.id })));
        
        // Find related register entries
        const saleBankEntries = await BankRegister.findAll({
          where: { relatedDocumentNumber: node.registrationNumber },
          attributes: ['id'],
          transaction
        });
        related.push(...saleBankEntries.map(br => ({ type: 'BANK_REGISTER', id: br.id })));
        
        const saleCashEntries = await CashRegister.findAll({
          where: { relatedDocumentNumber: node.registrationNumber },
          attributes: ['id', 'registrationNumber', 'amount', 'transactionType'],
          transaction
        });
        
        // ✅ DEBUG: Log cash register entries found for this sale
        console.log(`🔍 [DEBUG] Sale ${node.registrationNumber} found ${saleCashEntries.length} cash register entries:`);
        for (const entry of saleCashEntries) {
          console.log(`   - Cash Entry: ${entry.registrationNumber} (${entry.transactionType} ${entry.amount})`);
        }
        
        related.push(...saleCashEntries.map(cr => ({ type: 'CASH_REGISTER', id: cr.id })));
        break;
        
      case 'AP':
        // Find related bank/cash register entries for AP payments
        const apBankEntries = await BankRegister.findAll({
          where: { relatedDocumentNumber: node.registrationNumber },
          attributes: ['id'],
          transaction
        });
        related.push(...apBankEntries.map(br => ({ type: 'BANK_REGISTER', id: br.id })));
        
        const apCashEntries = await CashRegister.findAll({
          where: { relatedDocumentNumber: node.registrationNumber },
          attributes: ['id'],
          transaction
        });
        related.push(...apCashEntries.map(cr => ({ type: 'CASH_REGISTER', id: cr.id })));
        
        // Find related business expense for AP entries that originated from expenses
        const ap = await AccountsPayable.findByPk(node.id, { 
          attributes: ['relatedDocumentType', 'relatedDocumentId'],
          transaction 
        });
        if (ap && ap.relatedDocumentType === 'Business Expense' && ap.relatedDocumentId) {
          related.push({ type: 'BUSINESS_EXPENSE', id: ap.relatedDocumentId });
        }
        break;
        
      case 'AR':
        // Find related bank/cash register entries for AR collections
        const arBankEntries = await BankRegister.findAll({
          where: { relatedDocumentNumber: node.registrationNumber },
          attributes: ['id'],
          transaction
        });
        related.push(...arBankEntries.map(br => ({ type: 'BANK_REGISTER', id: br.id })));
        
        const arCashEntries = await CashRegister.findAll({
          where: { relatedDocumentNumber: node.registrationNumber },
          attributes: ['id'],
          transaction
        });
        related.push(...arCashEntries.map(cr => ({ type: 'CASH_REGISTER', id: cr.id })));
        break;
    }
    
    return related;
  }

  /**
   * Topological sort for dependency-safe deletion order
   * 
   * Algorithm: Kahn's algorithm for topological sorting
   * Time Complexity: O(V + E)
   * EXACT COPY from TransactionDeletionService
   */
  private topologicalSort(graph: { nodes: TransactionNode[], edges: Array<{from: number, to: number}> }): TransactionNode[] {
    const inDegree: Map<number, number> = new Map();
    const adjList: Map<number, number[]> = new Map();
    const nodeMap: Map<number, TransactionNode> = new Map();
    
    // Initialize data structures
    for (const node of graph.nodes) {
      inDegree.set(node.id, 0);
      adjList.set(node.id, []);
      nodeMap.set(node.id, node);
    }
    
    // Build adjacency list and calculate in-degrees
    for (const edge of graph.edges) {
      const fromList = adjList.get(edge.from) || [];
      fromList.push(edge.to);
      adjList.set(edge.from, fromList);
      
      const currentInDegree = inDegree.get(edge.to) || 0;
      inDegree.set(edge.to, currentInDegree + 1);
    }
    
    // Find nodes with no incoming edges (start points)
    const queue: number[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }
    
    const result: TransactionNode[] = [];
    
    // Process nodes in topological order
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentNode = nodeMap.get(currentId);
      
      if (currentNode) {
        result.push(currentNode);
        
        // Process neighbors
        const neighbors = adjList.get(currentId) || [];
        for (const neighborId of neighbors) {
          const currentDegree = inDegree.get(neighborId) || 0;
          inDegree.set(neighborId, currentDegree - 1);
          
          if (inDegree.get(neighborId) === 0) {
            queue.push(neighborId);
          }
        }
      }
    }
    
    // Check for cycles
    if (result.length !== graph.nodes.length) {
      console.warn(`⚠️ [Topological Sort] Possible cycle detected. Expected ${graph.nodes.length} nodes, got ${result.length}`);
    }
    
    console.log(`🔄 [Topological Sort] Deletion order: ${result.map(n => n.registrationNumber).join(' → ')}`);
    return result;
  }

  /**
   * Get dependency analysis for a transaction
   * Useful for showing impact before deletion
   */
  async getDependencyAnalysis(
    entityType: string,
    entityId: number,
    transaction: Transaction
  ): Promise<{
    totalNodes: number;
    nodesByType: Record<string, number>;
    deletionOrder: string[];
    estimatedOperations: number;
  }> {
    const graph = await this.buildTransactionDependencyGraph(entityType, entityId, transaction);
    
    // Count nodes by type
    const nodesByType: Record<string, number> = {};
    for (const node of graph.nodes) {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    }
    
    // Get deletion order
    const deletionOrder = graph.sortedNodes.map(n => n.registrationNumber);
    
    // Estimate operations (each node typically generates 2-4 operations)
    const estimatedOperations = graph.nodes.length * 3;
    
    return {
      totalNodes: graph.nodes.length,
      nodesByType,
      deletionOrder,
      estimatedOperations
    };
  }
}
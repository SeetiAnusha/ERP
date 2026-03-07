import CardPaymentNetwork from '../models/CardPaymentNetwork';
import ClientPaymentMethod from '../models/ClientPaymentMethod';
import Client from '../models/Client';
import BankAccount from '../models/BankAccount';

export const cardPaymentNetworkService = {
  // Get all payment networks
  async getAllNetworks() {
    return await CardPaymentNetwork.findAll({
      where: { isActive: true },
      order: [['name', 'ASC'], ['type', 'ASC']],
    });
  },

  // Get networks by type
  async getNetworksByType(type: 'DEBIT' | 'CREDIT') {
    return await CardPaymentNetwork.findAll({
      where: { 
        type,
        isActive: true 
      },
      order: [['name', 'ASC']],
    });
  },

  // Create new payment network
  async createNetwork(data: {
    name: string;
    type: 'DEBIT' | 'CREDIT';
    processingFee?: number;
    settlementDays?: number;
    description?: string;
  }) {
    return await CardPaymentNetwork.create({
      ...data,
      processingFee: data.processingFee ?? 0.0250, // Default processing fee
      settlementDays: data.settlementDays ?? 1, // Default settlement days
      isActive: true, // Default to active
    });
  },

  // Update payment network
  async updateNetwork(id: number, data: Partial<{
    name: string;
    processingFee: number;
    settlementDays: number;
    isActive: boolean;
    description: string;
  }>) {
    const [updatedRows] = await CardPaymentNetwork.update(data, {
      where: { id },
    });
    
    if (updatedRows === 0) {
      throw new Error('Payment network not found');
    }
    
    return await CardPaymentNetwork.findByPk(id);
  },

  // Delete payment network
  async deleteNetwork(id: number) {
    const network = await CardPaymentNetwork.findByPk(id);
    if (!network) {
      throw new Error('Payment network not found');
    }

    // Check if network is being used
    const usageCount = await ClientPaymentMethod.count({
      where: { cardPaymentNetworkId: id }
    });

    if (usageCount > 0) {
      throw new Error('Cannot delete payment network that is being used by clients');
    }

    await network.destroy();
    return { message: 'Payment network deleted successfully' };
  },

  // Get client payment methods
  async getClientPaymentMethods(clientId: number) {
    return await ClientPaymentMethod.findAll({
      where: { 
        clientId,
        isActive: true 
      },
      include: [
        {
          model: CardPaymentNetwork,
          as: 'CardPaymentNetwork',
        },
        {
          model: BankAccount,
          as: 'BankAccount',
        },
      ],
      order: [['isDefault', 'DESC'], ['createdAt', 'DESC']],
    });
  },

  // Create client payment method
  async createClientPaymentMethod(data: {
    clientId: number;
    paymentType: 'DEBIT_CARD' | 'CREDIT_CARD' | 'BANK_ACCOUNT';
    cardPaymentNetworkId?: number;
    bankAccountId?: number;
    cardHolderName?: string;
    cardLast4?: string;
    expiryMonth?: number;
    expiryYear?: number;
    creditLimit?: number;
    isDefault?: boolean;
    notes?: string;
  }) {
    // If this is set as default, unset other defaults for this client
    if (data.isDefault) {
      await ClientPaymentMethod.update(
        { isDefault: false },
        { where: { clientId: data.clientId } }
      );
    }

    return await ClientPaymentMethod.create({
      ...data,
      usedCredit: 0, // Initialize used credit to 0
      isActive: true, // Default to active
      isDefault: data.isDefault ?? false, // Default to false if not specified
    });
  },

  // Update client payment method
  async updateClientPaymentMethod(id: number, data: Partial<{
    cardHolderName: string;
    cardLast4: string;
    expiryMonth: number;
    expiryYear: number;
    creditLimit: number;
    isActive: boolean;
    isDefault: boolean;
    notes: string;
  }>) {
    const paymentMethod = await ClientPaymentMethod.findByPk(id);
    if (!paymentMethod) {
      throw new Error('Payment method not found');
    }

    // If setting as default, unset other defaults for this client
    if (data.isDefault) {
      await ClientPaymentMethod.update(
        { isDefault: false },
        { where: { clientId: paymentMethod.clientId } }
      );
    }

    await paymentMethod.update(data);
    return paymentMethod;
  },

  // Delete client payment method
  async deleteClientPaymentMethod(id: number) {
    const paymentMethod = await ClientPaymentMethod.findByPk(id);
    if (!paymentMethod) {
      throw new Error('Payment method not found');
    }

    await paymentMethod.destroy();
    return { message: 'Payment method deleted successfully' };
  },

  // Initialize default payment networks
  async initializeDefaultNetworks() {
    const networks = [
      { name: 'Visa', type: 'DEBIT' as const, processingFee: 0.0250, settlementDays: 1, isActive: true },
      { name: 'Visa', type: 'CREDIT' as const, processingFee: 0.0280, settlementDays: 2, isActive: true },
      { name: 'Mastercard', type: 'DEBIT' as const, processingFee: 0.0245, settlementDays: 1, isActive: true },
      { name: 'Mastercard', type: 'CREDIT' as const, processingFee: 0.0275, settlementDays: 2, isActive: true },
      { name: 'American Express', type: 'CREDIT' as const, processingFee: 0.0350, settlementDays: 3, isActive: true },
      { name: 'Discover', type: 'DEBIT' as const, processingFee: 0.0240, settlementDays: 1, isActive: true },
      { name: 'Discover', type: 'CREDIT' as const, processingFee: 0.0270, settlementDays: 2, isActive: true },
    ];

    const results = [];
    for (const network of networks) {
      const [created, wasCreated] = await CardPaymentNetwork.findOrCreate({
        where: { name: network.name, type: network.type },
        defaults: network,
      });
      results.push({ network: created, created: wasCreated });
    }

    return results;
  },
};
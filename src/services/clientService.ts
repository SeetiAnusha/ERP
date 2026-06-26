import Client from '../models/Client';
import { BaseService } from '../core/BaseService';

/**
 * ClientService
 * Manages all client (customer) operations.
 * Clients are the individuals or companies that purchase goods/services from the business.
 */
class ClientService extends BaseService {
  
  /**
   * Retrieves all clients with optional pagination, search, and filtering.
   * Searches across name, RNC (tax ID), email, and phone fields.
   * Used by: Client list page, Sale form dropdowns, AR collection forms.
   */
  async getAllClients(options: any = {}): Promise<any> {
    return this.executeWithRetry(async () => {
      const result = await this.getAllWithPagination(
        Client,
        {
          ...options,
          searchFields: ['name', 'rnc', 'email', 'phone'],
          dateField: 'createdAt'
        }
      );
      return result;
    });
  }

  /**
   * Finds a single client by their database ID.
   * Used when editing a client or loading client details for a transaction.
   */
  async getClientById(id: number) {
    return await Client.findByPk(id);
  }

  /**
   * Creates a new client record in the database.
   * Called when the user submits the "Add Client" form.
   */
  async createClient(data: any) {
    return this.executeWithRetry(async () => {
      return await Client.create(data);
    });
  }

  /**
   * Updates an existing client's information (name, RNC, contact details, etc.).
   * Throws an error if the client does not exist.
   */
  async updateClient(id: number, data: any) {
    return this.executeWithRetry(async () => {
      const client = await Client.findByPk(id);
      if (!client) throw new Error('Client not found');
      return await client.update(data);
    });
  }

  /**
   * Permanently deletes a client from the database.
   * Throws an error if the client does not exist.
   * Note: Clients with existing sales or AR records should not be deleted.
   */
  async deleteClient(id: number) {
    const client = await Client.findByPk(id);
    if (!client) throw new Error('Client not found');
    await client.destroy();
    return { message: 'Client deleted successfully' };
  }
}

const clientService = new ClientService();

export const getAllClients = (options?: any) => clientService.getAllClients(options);
export const getAllClientsWithPagination = (options?: any) => clientService.getAllClients(options);
export const getClientById = (id: number) => clientService.getClientById(id);
export const createClient = (data: any) => clientService.createClient(data);
export const updateClient = (id: number, data: any) => clientService.updateClient(id, data);
export const deleteClient = (id: number) => clientService.deleteClient(id);

import Client from '../models/Client';
import { BaseService } from '../core/BaseService';

class ClientService extends BaseService {
  
  async getAllClients(options: any = {}): Promise<any> {
    return this.executeWithRetry(async () => {
      // Use generic pagination from BaseService
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

  async getClientById(id: number) {
    return await Client.findByPk(id);
  }

  async createClient(data: any) {
    return await Client.create(data);
  }

  async updateClient(id: number, data: any) {
    const client = await Client.findByPk(id);
    if (!client) throw new Error('Client not found');
    return await client.update(data);
  }

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

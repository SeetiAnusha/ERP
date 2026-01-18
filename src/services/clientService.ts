import Client from '../models/Client';

export const getAllClients = async () => {
  return await Client.findAll({ order: [['createdAt', 'DESC']] });
};

export const getClientById = async (id: number) => {
  return await Client.findByPk(id);
};

export const createClient = async (data: any) => {
  return await Client.create(data);
};

export const updateClient = async (id: number, data: any) => {
  const client = await Client.findByPk(id);
  if (!client) throw new Error('Client not found');
  return await client.update(data);
};

export const deleteClient = async (id: number) => {
  const client = await Client.findByPk(id);
  if (!client) throw new Error('Client not found');
  await client.destroy();
  return { message: 'Client deleted successfully' };
};

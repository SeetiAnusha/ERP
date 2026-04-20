import Financer from '../models/Financer';
import { Op } from 'sequelize';
import { BaseService } from '../core/BaseService';

class FinancerService extends BaseService {
  
  async getAllFinancers() {
    return this.executeWithRetry(async () => {
      return await Financer.findAll({
        order: [['code', 'ASC']],
      });
    });
  }

  async getFinancerById(id: number) {
    return await Financer.findByPk(id);
  }

  async createFinancer(data: any) {
    return this.executeWithRetry(async () => {
      // Generate code (FN0001, FN0002, etc.)
      const lastFinancer = await Financer.findOne({
        where: {
          code: {
            [Op.like]: 'FN%'
          }
        },
        order: [['id', 'DESC']],
      });
      
      let nextNumber = 1;
      if (lastFinancer) {
        const lastNumber = parseInt(lastFinancer.code.substring(2));
        nextNumber = lastNumber + 1;
      }
      
      const code = `FN${String(nextNumber).padStart(4, '0')}`;
      
      return await Financer.create({
        ...data,
        code,
      });
    });
  }

  async updateFinancer(id: number, data: any) {
    return this.executeWithRetry(async () => {
      const financer = await Financer.findByPk(id);
      if (!financer) throw new Error('Financer not found');
      return await financer.update(data);
    });
  }

  async deleteFinancer(id: number) {
    const financer = await Financer.findByPk(id);
    if (!financer) throw new Error('Financer not found');
    await financer.destroy();
    return { message: 'Financer deleted successfully' };
  }
}

const financerService = new FinancerService();

export const getAllFinancers = () => financerService.getAllFinancers();
export const getFinancerById = (id: number) => financerService.getFinancerById(id);
export const createFinancer = (data: any) => financerService.createFinancer(data);
export const updateFinancer = (id: number, data: any) => financerService.updateFinancer(id, data);
export const deleteFinancer = (id: number) => financerService.deleteFinancer(id);

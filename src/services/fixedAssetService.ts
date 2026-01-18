import FixedAsset from '../models/FixedAsset';

export const getAllFixedAssets = async () => {
  return await FixedAsset.findAll({ order: [['createdAt', 'DESC']] });
};

export const getFixedAssetById = async (id: number) => {
  return await FixedAsset.findByPk(id);
};

export const createFixedAsset = async (data: any) => {
  const bookValue = data.acquisitionCost - data.accumulatedDepreciation;
  return await FixedAsset.create({ ...data, bookValue });
};

export const updateFixedAsset = async (id: number, data: any) => {
  const asset = await FixedAsset.findByPk(id);
  if (!asset) throw new Error('Fixed asset not found');
  
  if (data.acquisitionCost || data.accumulatedDepreciation) {
    const acquisitionCost = data.acquisitionCost || asset.acquisitionCost;
    const accumulatedDepreciation = data.accumulatedDepreciation || asset.accumulatedDepreciation;
    data.bookValue = acquisitionCost - accumulatedDepreciation;
  }
  
  return await asset.update(data);
};

export const deleteFixedAsset = async (id: number) => {
  const asset = await FixedAsset.findByPk(id);
  if (!asset) throw new Error('Fixed asset not found');
  await asset.destroy();
  return { message: 'Fixed asset deleted successfully' };
};

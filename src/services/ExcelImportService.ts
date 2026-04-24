// @ts-ignore - xlsx types may not be available in production
import * as XLSX from 'xlsx';
import Product from '../models/Product';
import Supplier from '../models/Supplier';
import Client from '../models/Client';
import sequelize from '../config/database';

interface ImportResult {
  success: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; error: string; data?: any }>;
  message: string;
}

class ExcelImportService {
  /**
   * Import Products from Excel file
   * Expected columns: code, name, description, unit, quantity, unitCost, salesPrice, taxRate
   * Duplicate detection: by 'code' field
   */
  async importProducts(buffer: Buffer): Promise<ImportResult> {
    const transaction = await sequelize.transaction();
    
    try {
      // Parse Excel file
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        await transaction.rollback();
        return {
          success: false,
          inserted: 0,
          updated: 0,
          skipped: 0,
          errors: [],
          message: 'Excel file is empty or has no data rows'
        };
      }

      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      const errors: Array<{ row: number; error: string; data?: any }> = [];

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row: any = data[i];
        const rowNumber = i + 2; // Excel row number (header is row 1)

        try {
          // Validate required fields
          if (!row.code || !row.name || !row.unit) {
            errors.push({
              row: rowNumber,
              error: 'Missing required fields: code, name, or unit',
              data: row
            });
            skipped++;
            continue;
          }

          // Prepare product data
          const amount = Number(row.quantity || row.amount || 0);
          const unitCost = Number(row.unitCost || row.unitPrice || 0);
          const salesPrice = Number(row.salesPrice || 0);
          const subtotal = amount * unitCost;

          const productData = {
            code: String(row.code).trim(),
            name: String(row.name).trim(),
            description: row.description ? String(row.description).trim() : '',
            unit: String(row.unit).trim(),
            amount: amount,
            unitCost: unitCost,
            salesPrice: salesPrice,
            subtotal: subtotal,
            category: row.category || 'General',
            minimumStock: Number(row.minimumStock || 10),
            taxRate: Number(row.taxRate || 18),
            status: row.status || 'ACTIVE'
          };

          // Check if product exists (by code)
          const existingProduct = await Product.findOne({
            where: { code: productData.code },
            transaction
          });

          if (existingProduct) {
            // Update existing product
            await existingProduct.update(productData, { transaction });
            updated++;
          } else {
            // Create new product
            await Product.create(productData, { transaction });
            inserted++;
          }
        } catch (error: any) {
          errors.push({
            row: rowNumber,
            error: error.message || 'Unknown error',
            data: row
          });
          skipped++;
        }
      }

      await transaction.commit();

      return {
        success: true,
        inserted,
        updated,
        skipped,
        errors,
        message: `Import completed: ${inserted} inserted, ${updated} updated, ${skipped} skipped`
      };
    } catch (error: any) {
      await transaction.rollback();
      return {
        success: false,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [{ row: 0, error: error.message || 'Failed to parse Excel file' }],
        message: 'Import failed: ' + error.message
      };
    }
  }

  /**
   * Import Suppliers from Excel file
   * Expected columns: code, name, rnc, phone, address, email, supplierType, paymentTerms
   * Duplicate detection: by 'rnc' field
   */
  async importSuppliers(buffer: Buffer): Promise<ImportResult> {
    const transaction = await sequelize.transaction();
    
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        await transaction.rollback();
        return {
          success: false,
          inserted: 0,
          updated: 0,
          skipped: 0,
          errors: [],
          message: 'Excel file is empty or has no data rows'
        };
      }

      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      const errors: Array<{ row: number; error: string; data?: any }> = [];

      for (let i = 0; i < data.length; i++) {
        const row: any = data[i];
        const rowNumber = i + 2;

        try {
          // Validate required fields
          if (!row.code || !row.name || !row.rnc || !row.phone || !row.address) {
            errors.push({
              row: rowNumber,
              error: 'Missing required fields: code, name, rnc, phone, or address',
              data: row
            });
            skipped++;
            continue;
          }

          const supplierData = {
            code: String(row.code).trim(),
            name: String(row.name).trim(),
            rnc: String(row.rnc).trim(),
            phone: String(row.phone).trim(),
            address: String(row.address).trim(),
            email: row.email ? String(row.email).trim() : undefined,
            supplierType: row.supplierType || 'LOCAL',
            paymentTerms: row.paymentTerms || 'CASH',
            currentBalance: Number(row.currentBalance || 0),
            status: row.status || 'ACTIVE',
            contactPerson: row.contactPerson ? String(row.contactPerson).trim() : undefined,
            notes: row.notes ? String(row.notes).trim() : undefined
          };

          // Check if supplier exists (by RNC - unique identifier)
          const existingSupplier = await Supplier.findOne({
            where: { rnc: supplierData.rnc },
            transaction
          });

          if (existingSupplier) {
            await existingSupplier.update(supplierData, { transaction });
            updated++;
          } else {
            await Supplier.create(supplierData, { transaction });
            inserted++;
          }
        } catch (error: any) {
          errors.push({
            row: rowNumber,
            error: error.message || 'Unknown error',
            data: row
          });
          skipped++;
        }
      }

      await transaction.commit();

      return {
        success: true,
        inserted,
        updated,
        skipped,
        errors,
        message: `Import completed: ${inserted} inserted, ${updated} updated, ${skipped} skipped`
      };
    } catch (error: any) {
      await transaction.rollback();
      return {
        success: false,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [{ row: 0, error: error.message || 'Failed to parse Excel file' }],
        message: 'Import failed: ' + error.message
      };
    }
  }

  /**
   * Import Clients from Excel file
   * Expected columns: code, name, rncCedula, phone, address, email, clientType, creditLimit, paymentTerms
   * Duplicate detection: by 'rncCedula' field
   */
  async importClients(buffer: Buffer): Promise<ImportResult> {
    const transaction = await sequelize.transaction();
    
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        await transaction.rollback();
        return {
          success: false,
          inserted: 0,
          updated: 0,
          skipped: 0,
          errors: [],
          message: 'Excel file is empty or has no data rows'
        };
      }

      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      const errors: Array<{ row: number; error: string; data?: any }> = [];

      for (let i = 0; i < data.length; i++) {
        const row: any = data[i];
        const rowNumber = i + 2;

        try {
          // Validate required fields
          if (!row.code || !row.name || !row.rncCedula || !row.phone || !row.address) {
            errors.push({
              row: rowNumber,
              error: 'Missing required fields: code, name, rncCedula, phone, or address',
              data: row
            });
            skipped++;
            continue;
          }

          const clientData = {
            code: String(row.code).trim(),
            name: String(row.name).trim(),
            rncCedula: String(row.rncCedula).trim(),
            phone: String(row.phone).trim(),
            address: String(row.address).trim(),
            email: row.email ? String(row.email).trim() : undefined,
            clientType: row.clientType || 'RETAIL',
            creditLimit: Number(row.creditLimit || 0),
            paymentTerms: row.paymentTerms || 'CASH',
            currentBalance: Number(row.currentBalance || 0),
            status: row.status || 'ACTIVE',
            contactPerson: row.contactPerson ? String(row.contactPerson).trim() : undefined,
            notes: row.notes ? String(row.notes).trim() : undefined
          };

          // Check if client exists (by RNC/Cedula - unique identifier)
          const existingClient = await Client.findOne({
            where: { rncCedula: clientData.rncCedula },
            transaction
          });

          if (existingClient) {
            await existingClient.update(clientData, { transaction });
            updated++;
          } else {
            await Client.create(clientData, { transaction });
            inserted++;
          }
        } catch (error: any) {
          errors.push({
            row: rowNumber,
            error: error.message || 'Unknown error',
            data: row
          });
          skipped++;
        }
      }

      await transaction.commit();

      return {
        success: true,
        inserted,
        updated,
        skipped,
        errors,
        message: `Import completed: ${inserted} inserted, ${updated} updated, ${skipped} skipped`
      };
    } catch (error: any) {
      await transaction.rollback();
      return {
        success: false,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [{ row: 0, error: error.message || 'Failed to parse Excel file' }],
        message: 'Import failed: ' + error.message
      };
    }
  }
}

export default new ExcelImportService();

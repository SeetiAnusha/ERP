import { Router } from 'express';
import multer from 'multer';
import { importProducts, importSuppliers, importClients } from '../controllers/importController';

const router = Router();

// Configure multer for memory storage (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel files are allowed.'));
    }
  }
});

/**
 * @route   POST /api/import/products
 * @desc    Import products from Excel file
 * @access  Public (add authentication middleware if needed)
 */
router.post('/products', upload.single('file'), importProducts);

/**
 * @route   POST /api/import/suppliers
 * @desc    Import suppliers from Excel file
 * @access  Public (add authentication middleware if needed)
 */
router.post('/suppliers', upload.single('file'), importSuppliers);

/**
 * @route   POST /api/import/clients
 * @desc    Import clients from Excel file
 * @access  Public (add authentication middleware if needed)
 */
router.post('/clients', upload.single('file'), importClients);

export default router;

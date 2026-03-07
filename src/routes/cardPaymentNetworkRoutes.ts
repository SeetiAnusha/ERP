import { Router } from 'express';
import { cardPaymentNetworkService } from '../services/cardPaymentNetworkService';

const router = Router();

// Get all payment networks
router.get('/', async (req, res) => {
  try {
    const networks = await cardPaymentNetworkService.getAllNetworks();
    res.json(networks);
  } catch (error) {
    console.error('Error fetching payment networks:', error);
    res.status(500).json({ error: 'Failed to fetch payment networks' });
  }
});

// Get networks by type
router.get('/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    if (type !== 'DEBIT' && type !== 'CREDIT') {
      return res.status(400).json({ error: 'Invalid type. Must be DEBIT or CREDIT' });
    }
    
    const networks = await cardPaymentNetworkService.getNetworksByType(type);
    res.json(networks);
  } catch (error) {
    console.error('Error fetching payment networks by type:', error);
    res.status(500).json({ error: 'Failed to fetch payment networks' });
  }
});

// Create payment network
router.post('/', async (req, res) => {
  try {
    const network = await cardPaymentNetworkService.createNetwork(req.body);
    res.status(201).json(network);
  } catch (error) {
    console.error('Error creating payment network:', error);
    res.status(500).json({ error: 'Failed to create payment network' });
  }
});

// Update payment network
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const network = await cardPaymentNetworkService.updateNetwork(parseInt(id), req.body);
    res.json(network);
  } catch (error) {
    console.error('Error updating payment network:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update payment network' });
  }
});

// Delete payment network
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await cardPaymentNetworkService.deleteNetwork(parseInt(id));
    res.json(result);
  } catch (error) {
    console.error('Error deleting payment network:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete payment network' });
  }
});

// Initialize default networks
router.post('/initialize', async (req, res) => {
  try {
    const results = await cardPaymentNetworkService.initializeDefaultNetworks();
    res.json({ 
      message: 'Default payment networks initialized',
      results 
    });
  } catch (error) {
    console.error('Error initializing payment networks:', error);
    res.status(500).json({ error: 'Failed to initialize payment networks' });
  }
});

// Client payment methods routes
router.get('/client/:clientId/payment-methods', async (req, res) => {
  try {
    const { clientId } = req.params;
    const paymentMethods = await cardPaymentNetworkService.getClientPaymentMethods(parseInt(clientId));
    res.json(paymentMethods);
  } catch (error) {
    console.error('Error fetching client payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch client payment methods' });
  }
});

// Create client payment method
router.post('/client/:clientId/payment-methods', async (req, res) => {
  try {
    const { clientId } = req.params;
    const paymentMethod = await cardPaymentNetworkService.createClientPaymentMethod({
      ...req.body,
      clientId: parseInt(clientId),
    });
    res.status(201).json(paymentMethod);
  } catch (error) {
    console.error('Error creating client payment method:', error);
    res.status(500).json({ error: 'Failed to create client payment method' });
  }
});

// Update client payment method
router.put('/client/payment-methods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const paymentMethod = await cardPaymentNetworkService.updateClientPaymentMethod(parseInt(id), req.body);
    res.json(paymentMethod);
  } catch (error) {
    console.error('Error updating client payment method:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update payment method' });
  }
});

// Delete client payment method
router.delete('/client/payment-methods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await cardPaymentNetworkService.deleteClientPaymentMethod(parseInt(id));
    res.json(result);
  } catch (error) {
    console.error('Error deleting client payment method:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete payment method' });
  }
});

export default router;
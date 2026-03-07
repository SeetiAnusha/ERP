import { Router, Request, Response } from 'express';
import * as recentActivityService from '../services/recentActivityService';

const router = Router();

// Get recent investment and loan activity
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const activities = await recentActivityService.getRecentActivity(limit);
    res.json(activities);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get activity by date range
router.get('/date-range', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    const activities = await recentActivityService.getActivityByDateRange(
      startDate as string, 
      endDate as string
    );
    res.json(activities);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get activity statistics
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const statistics = await recentActivityService.getActivityStatistics();
    res.json(statistics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
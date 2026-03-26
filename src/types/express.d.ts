/**
 * Express Request Type Extensions
 * Adds custom properties to Express Request interface
 */

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        email: string;
        role: string;
      };
    }
  }
}

export {};
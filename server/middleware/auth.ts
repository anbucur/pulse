import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/index.js';

export interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, jwtConfig.secret) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const authorize = (...roles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check user roles here if needed
      next();
    } catch (error) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  };
};

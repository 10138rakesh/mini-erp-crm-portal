import { Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthRequest, UserPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123_change_this_in_production';

export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
      }
      req.user = decoded as UserPayload;
      next();
    });
  } else {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
    }

    if (req.user.role === 'Admin' || allowedRoles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ error: `Forbidden: Access restricted. Requires one of roles: [${allowedRoles.join(', ')}]` });
    }
  };
};

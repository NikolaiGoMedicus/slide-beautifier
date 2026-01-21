import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Simple token generation - in production use a proper JWT library
const generateToken = (password: string): string => {
  const secret = process.env.AUTH_SECRET || 'slide-beautifier-secret';
  return crypto.createHmac('sha256', secret).update(password).digest('hex');
};

const APP_PASSWORD = process.env.APP_PASSWORD || 'beautify123';
const VALID_TOKEN = generateToken(APP_PASSWORD);

export function verifyPassword(password: string): { valid: boolean; token?: string } {
  if (password === APP_PASSWORD) {
    return { valid: true, token: VALID_TOKEN };
  }
  return { valid: false };
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for auth endpoint itself
  if (req.path === '/api/auth') {
    next();
    return;
  }

  // Check for token in Authorization header
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // Also check for token in query parameter (for download links)
  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (token !== VALID_TOKEN) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  next();
}

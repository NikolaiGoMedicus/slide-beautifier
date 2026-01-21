import { Router, type Request, type Response } from 'express';
import { verifyPassword } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/', (req: Request, res: Response): void => {
  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Password is required' });
    return;
  }

  const result = verifyPassword(password);

  if (result.valid) {
    res.json({ success: true, token: result.token });
  } else {
    res.status(401).json({ success: false, error: 'Invalid password' });
  }
});

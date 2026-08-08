import { Request } from 'express';

export interface UserPayload {
  id: string;
  username: string;
  name: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: UserPayload;
}

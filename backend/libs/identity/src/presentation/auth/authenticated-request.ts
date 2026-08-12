import type { Request } from 'express';
import type { SessionPrincipal } from '../../application';

export interface AuthenticatedRequest extends Request {
  auth: SessionPrincipal;
}

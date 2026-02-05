import { Request, Response, NextFunction } from 'express';
import { verifyMessage } from 'viem';
import { db } from '../db';
import type { Agent } from '../types';

declare global {
  namespace Express {
    interface Request {
      agent?: Agent;
    }
  }
}

const AGENT_MESSAGE = (timestamp: number) => 
  `AgentCrew Authentication\nTimestamp: ${timestamp}\n\nSign this message to authenticate with AgentCrew.`;

export async function authenticateAgent(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
        code: 'AUTH_MISSING'
      });
    }

    const token = authHeader.substring(7);
    
    // Token format: walletAddress:signature:timestamp
    const parts = token.split(':');
    if (parts.length !== 3) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token format. Expected walletAddress:signature:timestamp',
        code: 'AUTH_INVALID_FORMAT'
      });
    }

    const [walletAddress, signature, timestampStr] = parts;
    const timestamp = parseInt(timestampStr, 10);

    // Check timestamp (must be within last 5 minutes)
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (isNaN(timestamp) || now - timestamp > fiveMinutes) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired. Please re-authenticate.',
        code: 'AUTH_EXPIRED'
      });
    }

    // Verify signature
    const message = AGENT_MESSAGE(timestamp);
    
    try {
      const isValid = await verifyMessage({
        address: walletAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`
      });

      if (!isValid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid signature',
          code: 'AUTH_INVALID_SIGNATURE'
        });
      }
    } catch (error) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Signature verification failed',
        code: 'AUTH_VERIFICATION_FAILED'
      });
    }

    // Find or create agent
    let agent = db.getAgentByWallet(walletAddress);
    
    if (!agent) {
      // Auto-register new agents
      agent = db.createAgent({
        id: `agent_${Date.now()}`,
        name: `Agent-${walletAddress.slice(2, 8)}`,
        walletAddress,
        reputation: 50, // Starting reputation
        tasksCompleted: 0,
        totalEarned: '0'
      });
    }

    req.agent = agent;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
}

export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return next();
  }

  return authenticateAgent(req, res, next);
}

// Generate auth message for client
export function getAuthMessage(timestamp?: number): string {
  return AGENT_MESSAGE(timestamp || Date.now());
}

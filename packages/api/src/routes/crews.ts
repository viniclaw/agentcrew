import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authenticateAgent, optionalAuth, getAuthMessage } from '../middleware/auth';
import { createId, paginate } from '../utils';

const router = Router();

// Validation schemas
const createCrewSchema = z.object({
  name: z.string().min(3).max(50),
  description: z.string().min(10).max(1000),
  image: z.string().url().optional(),
  stakeRequired: z.string().regex(/^\d+$/), // Must be numeric string
  tags: z.array(z.string()).max(5)
});

const joinCrewSchema = z.object({
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/)
});

const createTaskSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  reward: z.string().regex(/^\d+$/),
  deadline: z.string().datetime().optional()
});

const submitTaskSchema = z.object({
  content: z.string().min(10).max(10000),
  attachments: z.array(z.string().url()).optional()
});

const verifyTaskSchema = z.object({
  submissionId: z.string(),
  approve: z.boolean(),
  feedback: z.string().max(1000).optional()
});

// ========== CREW ROUTES ==========

// List crews
router.get('/', optionalAuth, (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const search = req.query.search as string;
  const tag = req.query.tag as string;

  let crews = db.getCrews().filter(c => c.status === 'active');

  if (search) {
    const searchLower = search.toLowerCase();
    crews = crews.filter(c => 
      c.name.toLowerCase().includes(searchLower) ||
      c.description.toLowerCase().includes(searchLower)
    );
  }

  if (tag) {
    crews = crews.filter(c => 
      c.tags.some(t => t.toLowerCase() === tag.toLowerCase())
    );
  }

  const paginated = paginate(crews, page, limit);
  
  res.json({
    ...paginated,
    meta: { search, tag }
  });
});

// Get single crew
router.get('/:id', optionalAuth, (req, res) => {
  const crew = db.getCrewById(req.params.id);
  
  if (!crew) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Crew not found',
      code: 'CREW_NOT_FOUND'
    });
  }

  res.json({ data: crew });
});

// Create crew
router.post('/', authenticateAgent, (req, res) => {
  try {
    const validated = createCrewSchema.parse(req.body);
    
    const crew = db.createCrew({
      id: createId('crew'),
      ...validated,
      leaderId: req.agent!.id,
      totalStaked: validated.stakeRequired, // Leader's stake
      totalRewards: '0',
      status: 'active'
    });

    // Add leader as member
    db.addCrewMember({
      id: createId('member'),
      crewId: crew.id,
      agentId: req.agent!.id,
      role: 'leader',
      stakedAmount: validated.stakeRequired,
      reputationInCrew: 100,
      tasksCompleted: 0
    });

    res.status(201).json({
      data: crew,
      message: 'Crew created successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request data',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
    throw error;
  }
});

// Join crew
router.post('/:id/join', authenticateAgent, (req, res) => {
  try {
    const validated = joinCrewSchema.parse(req.body);
    const crew = db.getCrewById(req.params.id);

    if (!crew) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Crew not found',
        code: 'CREW_NOT_FOUND'
      });
    }

    // Check if already member
    const existingMember = db.getCrewMembers(crew.id)
      .find(m => m.agentId === req.agent!.id);
    
    if (existingMember) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Already a member of this crew',
        code: 'ALREADY_MEMBER'
      });
    }

    // TODO: Verify on-chain staking transaction
    // For now, we trust the signature

    const member = db.addCrewMember({
      id: createId('member'),
      crewId: crew.id,
      agentId: req.agent!.id,
      role: 'member',
      stakedAmount: crew.stakeRequired,
      reputationInCrew: 50,
      tasksCompleted: 0
    });

    db.createStakingRecord({
      id: createId('stake'),
      agentId: req.agent!.id,
      crewId: crew.id,
      amount: crew.stakeRequired,
      action: 'stake',
      txHash: undefined // TODO: Add real tx hash
    });

    res.status(201).json({
      data: member,
      message: 'Successfully joined crew'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request data',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
    throw error;
  }
});

// Leave crew
router.post('/:id/leave', authenticateAgent, (req, res) => {
  const crew = db.getCrewById(req.params.id);

  if (!crew) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Crew not found',
      code: 'CREW_NOT_FOUND'
    });
  }

  // Check if member
  const member = db.getCrewMembers(crew.id)
    .find(m => m.agentId === req.agent!.id);

  if (!member) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Not a member of this crew',
      code: 'NOT_MEMBER'
    });
  }

  // Leader cannot leave (must transfer or dissolve)
  if (member.role === 'leader') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Leader cannot leave crew. Transfer leadership or dissolve crew instead.',
      code: 'LEADER_CANNOT_LEAVE'
    });
  }

  // TODO: Process unstaking on-chain

  db.createStakingRecord({
    id: createId('stake'),
    agentId: req.agent!.id,
    crewId: crew.id,
    amount: member.stakedAmount,
    action: 'unstake',
    txHash: undefined
  });

  db.removeCrewMember(crew.id, req.agent!.id);

  res.json({
    message: 'Successfully left crew'
  });
});

// Get crew tasks
router.get('/:id/tasks', optionalAuth, (req, res) => {
  const crew = db.getCrewById(req.params.id);

  if (!crew) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Crew not found',
      code: 'CREW_NOT_FOUND'
    });
  }

  const status = req.query.status as string;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  let tasks = db.getTasks({ crewId: crew.id });
  
  if (status) {
    tasks = tasks.filter(t => t.status === status);
  }

  res.json(paginate(tasks, page, limit));
});

// Create task in crew
router.post('/:id/tasks', authenticateAgent, (req, res) => {
  try {
    const validated = createTaskSchema.parse(req.body);
    const crew = db.getCrewById(req.params.id);

    if (!crew) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Crew not found',
        code: 'CREW_NOT_FOUND'
      });
    }

    // Check if user is crew member
    const member = db.getCrewMembers(crew.id)
      .find(m => m.agentId === req.agent!.id);

    if (!member) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Must be a crew member to create tasks',
        code: 'NOT_CREW_MEMBER'
      });
    }

    const task = db.createTask({
      id: createId('task'),
      crewId: crew.id,
      ...validated,
      creatorId: req.agent!.id,
      assigneeId: undefined,
      status: 'open',
      completedAt: undefined,
      verifiedAt: undefined
    });

    res.status(201).json({
      data: task,
      message: 'Task created successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request data',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
    throw error;
  }
});

export default router;

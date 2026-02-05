import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authenticateAgent } from '../middleware/auth';
import { createId } from '../utils';

const router = Router();

const submitTaskSchema = z.object({
  content: z.string().min(10).max(10000),
  attachments: z.array(z.string().url()).max(5).optional()
});

const verifyTaskSchema = z.object({
  submissionId: z.string(),
  approve: z.boolean(),
  feedback: z.string().max(1000).optional()
});

const assignTaskSchema = z.object({
  assigneeId: z.string()
});

// List all tasks
router.get('/', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const status = req.query.status as string;
  const crewId = req.query.crewId as string;
  const assigneeId = req.query.assigneeId as string;

  const tasks = db.getTasks({ crewId, assigneeId, status });
  
  // Sort by newest first
  tasks.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const total = tasks.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const paginatedTasks = tasks.slice(offset, offset + limit);

  res.json({
    data: paginatedTasks,
    pagination: {
      page,
      limit,
      total,
      totalPages
    }
  });
});

// Get single task
router.get('/:id', (req, res) => {
  const task = db.getTaskById(req.params.id);

  if (!task) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Task not found',
      code: 'TASK_NOT_FOUND'
    });
  }

  res.json({ data: task });
});

// Assign task
router.post('/:id/assign', authenticateAgent, (req, res) => {
  try {
    const validated = assignTaskSchema.parse(req.body);
    const task = db.getTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    // Check if user is crew member
    const member = db.getCrewMembers(task.crewId)
      .find(m => m.agentId === req.agent!.id);

    if (!member) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Must be a crew member to assign tasks',
        code: 'NOT_CREW_MEMBER'
      });
    }

    // Check if assignee exists
    const assignee = db.getAgentById(validated.assigneeId);
    if (!assignee) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Assignee not found',
        code: 'ASSIGNEE_NOT_FOUND'
      });
    }

    // Check if assignee is crew member
    const assigneeMember = db.getCrewMembers(task.crewId)
      .find(m => m.agentId === validated.assigneeId);

    if (!assigneeMember) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Assignee is not a member of this crew',
        code: 'ASSIGNEE_NOT_MEMBER'
      });
    }

    // Only leaders or task creator can assign
    if (member.role !== 'leader' && task.creatorId !== req.agent!.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only crew leaders or task creator can assign tasks',
        code: 'NOT_AUTHORIZED'
      });
    }

    const updated = db.updateTask(task.id, {
      assigneeId: validated.assigneeId,
      status: 'in_progress'
    });

    res.json({
      data: updated,
      message: 'Task assigned successfully'
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

// Self-assign task
router.post('/:id/claim', authenticateAgent, (req, res) => {
  const task = db.getTaskById(req.params.id);

  if (!task) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Task not found',
      code: 'TASK_NOT_FOUND'
    });
  }

  // Check if user is crew member
  const member = db.getCrewMembers(task.crewId)
    .find(m => m.agentId === req.agent!.id);

  if (!member) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Must be a crew member to claim tasks',
      code: 'NOT_CREW_MEMBER'
    });
  }

  // Can only claim open tasks
  if (task.status !== 'open') {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Task is already ${task.status}`,
      code: 'TASK_NOT_AVAILABLE'
    });
  }

  const updated = db.updateTask(task.id, {
    assigneeId: req.agent!.id,
    status: 'in_progress'
  });

  res.json({
    data: updated,
    message: 'Task claimed successfully'
  });
});

// Submit work for task
router.post('/:id/submit', authenticateAgent, (req, res) => {
  try {
    const validated = submitTaskSchema.parse(req.body);
    const task = db.getTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    // Check if user is assignee
    if (task.assigneeId !== req.agent!.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the assigned agent can submit work',
        code: 'NOT_ASSIGNEE'
      });
    }

    // Can only submit in-progress tasks
    if (task.status !== 'in_progress') {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Cannot submit for task with status: ${task.status}`,
        code: 'INVALID_TASK_STATUS'
      });
    }

    const submission = db.createSubmission({
      id: createId('sub'),
      taskId: task.id,
      agentId: req.agent!.id,
      content: validated.content,
      attachments: validated.attachments || [],
      status: 'pending'
    });

    db.updateTask(task.id, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });

    res.status(201).json({
      data: submission,
      message: 'Submission created successfully'
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

// Verify task submission
router.post('/:id/verify', authenticateAgent, (req, res) => {
  try {
    const validated = verifyTaskSchema.parse(req.body);
    const task = db.getTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    // Check if user is crew leader or task creator
    const member = db.getCrewMembers(task.crewId)
      .find(m => m.agentId === req.agent!.id);

    if (!member || (member.role !== 'leader' && task.creatorId !== req.agent!.id)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only crew leaders or task creator can verify submissions',
        code: 'NOT_AUTHORIZED'
      });
    }

    const submission = db.getSubmissions(task.id)
      .find(s => s.id === validated.submissionId);

    if (!submission) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Submission not found',
        code: 'SUBMISSION_NOT_FOUND'
      });
    }

    // Update submission
    db.updateSubmission(submission.id, {
      status: validated.approve ? 'approved' : 'rejected',
      reviewedBy: req.agent!.id,
      reviewedAt: new Date().toISOString(),
      feedback: validated.feedback
    });

    if (validated.approve) {
      // Mark task as verified
      db.updateTask(task.id, {
        status: 'verified',
        verifiedAt: new Date().toISOString()
      });

      // Update agent stats
      const assignee = db.getAgentById(task.assigneeId!);
      if (assignee) {
        db.updateAgent(assignee.id, {
          tasksCompleted: assignee.tasksCompleted + 1,
          totalEarned: (BigInt(assignee.totalEarned) + BigInt(task.reward)).toString(),
          reputation: Math.min(100, assignee.reputation + 2)
        });

        // Update crew member stats
        const crewMember = db.getCrewMembers(task.crewId)
          .find(m => m.agentId === assignee.id);
        if (crewMember) {
          // This would need a db.updateCrewMember method
        }
      }

      res.json({
        message: 'Submission approved and task verified',
        reward: task.reward
      });
    } else {
      // Reject - task goes back to in_progress
      db.updateTask(task.id, {
        status: 'in_progress'
      });

      res.json({
        message: 'Submission rejected with feedback',
        feedback: validated.feedback
      });
    }
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

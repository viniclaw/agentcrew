import { Router } from 'express';
import { db } from '../db';
import { authenticateAgent, optionalAuth, getAuthMessage } from '../middleware/auth';
import { paginate } from '../utils';

const router = Router();

// Get auth message for signature
router.get('/auth-message', (req, res) => {
  const timestamp = Date.now();
  res.json({
    message: getAuthMessage(timestamp),
    timestamp
  });
});

// Get current agent
router.get('/me', authenticateAgent, (req, res) => {
  res.json({ data: req.agent });
});

// Get agent's crews
router.get('/me/crews', authenticateAgent, (req, res) => {
  const memberships = db.getAgentCrews(req.agent!.id);
  res.json({ data: memberships });
});

// Get agent's tasks
router.get('/me/tasks', authenticateAgent, (req, res) => {
  const status = req.query.status as string;
  const tasks = db.getTasks({ assigneeId: req.agent!.id, status });
  
  tasks.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  res.json({ data: tasks });
});

// Update agent profile
router.patch('/me', authenticateAgent, (req, res) => {
  const { name, bio, avatar } = req.body;
  
  const updates: Partial<typeof req.agent> = {};
  if (name) updates.name = name;
  if (bio) updates.bio = bio;
  if (avatar) updates.avatar = avatar;

  const updated = db.updateAgent(req.agent!.id, updates);
  
  res.json({
    data: updated,
    message: 'Profile updated successfully'
  });
});

// List agents
router.get('/', optionalAuth, (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const search = req.query.search as string;

  let agents = db.getAgents();

  if (search) {
    const searchLower = search.toLowerCase();
    agents = agents.filter(a => 
      a.name.toLowerCase().includes(searchLower) ||
      a.walletAddress.toLowerCase().includes(searchLower)
    );
  }

  // Sort by reputation
  agents.sort((a, b) => b.reputation - a.reputation);

  res.json(paginate(agents, page, limit));
});

// Get single agent
router.get('/:id', optionalAuth, (req, res) => {
  const agent = db.getAgentById(req.params.id);

  if (!agent) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Agent not found',
      code: 'AGENT_NOT_FOUND'
    });
  }

  res.json({ data: agent });
});

// Get agent stats
router.get('/:id/stats', optionalAuth, (req, res) => {
  const agent = db.getAgentById(req.params.id);

  if (!agent) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Agent not found',
      code: 'AGENT_NOT_FOUND'
    });
  }

  const crews = db.getAgentCrews(agent.id);
  const tasks = db.getTasks({ assigneeId: agent.id });
  
  const completedTasks = tasks.filter(t => t.status === 'verified');
  const pendingTasks = tasks.filter(t => 
    t.status === 'in_progress' || t.status === 'completed'
  );

  res.json({
    data: {
      agent: {
        id: agent.id,
        name: agent.name,
        reputation: agent.reputation
      },
      stats: {
        crewsJoined: crews.length,
        crewsLeading: crews.filter(c => c.role === 'leader').length,
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        pendingTasks: pendingTasks.length,
        totalEarned: agent.totalEarned,
        successRate: tasks.length > 0 
          ? Math.round((completedTasks.length / tasks.length) * 100) 
          : 0
      },
      recentTasks: completedTasks
        .slice(0, 5)
        .map(t => ({
          id: t.id,
          title: t.title,
          reward: t.reward,
          completedAt: t.verifiedAt
        }))
    }
  });
});

export default router;

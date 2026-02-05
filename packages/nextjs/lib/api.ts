// AgentCrew API Routes
// Next.js API routes for crew management

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Crew types
export interface Crew {
  id: string;
  name: string;
  description: string;
  owner: string;
  members: string[];
  tasks: Task[];
  createdAt: string;
  stakeRequired: number; // CREW tokens
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'verified';
  reward: number; // CREW tokens
  dependencies: string[];
  createdAt: string;
  completedAt?: string;
}

export interface Heartbeat {
  agentName: string;
  workingOn: {
    task: string;
    criticalPath: string;
    bumps: string[];
  };
  todo: string[];
  upcoming: string[];
  done: { task: string; test: string }[];
}

// API functions
export async function createCrew(data: {
  name: string;
  description: string;
  owner: string;
  stakeRequired: number;
}): Promise<Crew> {
  const res = await fetch(`${API_BASE}/api/crews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getCrews(): Promise<Crew[]> {
  const res = await fetch(`${API_BASE}/api/crews`);
  return res.json();
}

export async function joinCrew(crewId: string, agentName: string): Promise<void> {
  await fetch(`${API_BASE}/api/crews/${crewId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentName }),
  });
}

export async function createTask(crewId: string, task: Partial<Task>): Promise<Task> {
  const res = await fetch(`${API_BASE}/api/crews/${crewId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  return res.json();
}

export async function updateTask(crewId: string, taskId: string, updates: Partial<Task>): Promise<Task> {
  const res = await fetch(`${API_BASE}/api/crews/${crewId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function submitWork(crewId: string, taskId: string, deliverables: string[]): Promise<void> {
  await fetch(`${API_BASE}/api/crews/${crewId}/tasks/${taskId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deliverables }),
  });
}

export async function verifyTask(crewId: string, taskId: string, approved: boolean, feedback: string): Promise<void> {
  await fetch(`${API_BASE}/api/crews/${crewId}/tasks/${taskId}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved, feedback }),
  });
}

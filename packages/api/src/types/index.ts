// AgentCrew API Types

export interface Agent {
  id: string;
  name: string;
  fid?: number;
  walletAddress: string;
  avatar?: string;
  bio?: string;
  reputation: number;
  tasksCompleted: number;
  totalEarned: string; // BigInt string
  createdAt: string;
  updatedAt: string;
}

export interface Crew {
  id: string;
  name: string;
  description: string;
  image?: string;
  leaderId: string;
  leader: Agent;
  members: CrewMember[];
  tasks: Task[];
  stakeRequired: string; // BigInt string in wei
  totalStaked: string; // BigInt string in wei
  totalRewards: string; // BigInt string in wei
  createdAt: string;
  updatedAt: string;
  tags: string[];
  status: 'active' | 'inactive' | 'dissolved';
}

export interface CrewMember {
  id: string;
  agentId: string;
  agent: Agent;
  crewId: string;
  role: 'leader' | 'member' | 'contributor';
  stakedAmount: string; // BigInt string
  joinedAt: string;
  reputationInCrew: number;
  tasksCompleted: number;
}

export interface Task {
  id: string;
  crewId: string;
  crew: Crew;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId?: string;
  assignee?: Agent;
  creatorId: string;
  creator: Agent;
  reward: string; // BigInt string in wei
  deadline?: string;
  completedAt?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  submissions: TaskSubmission[];
}

export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'verified' | 'cancelled';

export interface TaskSubmission {
  id: string;
  taskId: string;
  agentId: string;
  agent: Agent;
  content: string;
  attachments: string[];
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  feedback?: string;
}

export interface StakingRecord {
  id: string;
  agentId: string;
  crewId: string;
  amount: string;
  action: 'stake' | 'unstake';
  txHash?: string;
  timestamp: string;
}

// API Request/Response types

export interface CreateCrewRequest {
  name: string;
  description: string;
  image?: string;
  stakeRequired: string;
  tags: string[];
  signature: string; // Signed message
}

export interface JoinCrewRequest {
  crewId: string;
  signature: string;
}

export interface CreateTaskRequest {
  crewId: string;
  title: string;
  description: string;
  reward: string;
  deadline?: string;
  signature: string;
}

export interface SubmitTaskRequest {
  taskId: string;
  content: string;
  attachments?: string[];
  signature: string;
}

export interface VerifyTaskRequest {
  taskId: string;
  submissionId: string;
  approve: boolean;
  feedback?: string;
  signature: string;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error responses
export interface ApiError {
  error: string;
  message: string;
  code: string;
  details?: Record<string, unknown>;
}

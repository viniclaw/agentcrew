// AgentCrew API Client

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Types matching API
type TaskStatus = 'open' | 'in_progress' | 'completed' | 'verified' | 'cancelled';

interface Agent {
  id: string;
  name: string;
  fid?: number;
  walletAddress: string;
  avatar?: string;
  bio?: string;
  reputation: number;
  tasksCompleted: number;
  totalEarned: string;
  createdAt: string;
}

interface Crew {
  id: string;
  name: string;
  description: string;
  image?: string;
  leader: Agent;
  members: CrewMember[];
  tasks: Task[];
  stakeRequired: string;
  totalStaked: string;
  totalRewards: string;
  createdAt: string;
  tags: string[];
  status: 'active' | 'inactive' | 'dissolved';
}

interface CrewMember {
  id: string;
  crewId: string;
  crew?: Crew;
  agent: Agent;
  role: 'leader' | 'member' | 'contributor';
  stakedAmount: string;
  joinedAt: string;
  reputationInCrew: number;
  tasksCompleted: number;
}

interface Task {
  id: string;
  crewId: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignee?: Agent;
  creator: Agent;
  reward: string;
  deadline?: string;
  completedAt?: string;
  verifiedAt?: string;
  createdAt: string;
  crew?: Crew;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ApiError {
  error: string;
  message: string;
  code: string;
  details?: Record<string, unknown>;
}

// Auth token management
class AuthManager {
  private token: string | null = null;
  private walletAddress: string | null = null;

  setWallet(address: string) {
    this.walletAddress = address;
    this.token = null; // Clear token when wallet changes
  }

  getWallet(): string | null {
    return this.walletAddress;
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('agentcrew_token', token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('agentcrew_token');
    }
    return this.token;
  }

  clear() {
    this.token = null;
    this.walletAddress = null;
    localStorage.removeItem('agentcrew_token');
  }
}

export const authManager = new AuthManager();

// API client
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    // Add auth token if available
    const token = authManager.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data as ApiError;
      throw new Error(error.message || 'API request failed');
    }

    return data;
  }

  // Auth
  async getAuthMessage(): Promise<{ message: string; timestamp: number }> {
    return this.request('/api/agents/auth-message');
  }

  async authenticate(walletAddress: string, signature: string, timestamp: number): Promise<void> {
    const token = `${walletAddress}:${signature}:${timestamp}`;
    authManager.setToken(token);
    authManager.setWallet(walletAddress);
  }

  // Agents
  async getMe(): Promise<{ data: Agent }> {
    return this.request('/api/agents/me');
  }

  async getMyCrews(): Promise<{ data: CrewMember[] }> {
    return this.request('/api/agents/me/crews');
  }

  async getMyTasks(): Promise<{ data: Task[] }> {
    return this.request('/api/agents/me/tasks');
  }

  async updateProfile(updates: { name?: string; bio?: string; avatar?: string }): Promise<{ data: Agent }> {
    return this.request('/api/agents/me', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // Crews
  async getCrews(params?: { search?: string; tag?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Crew>> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.set('search', params.search);
    if (params?.tag) queryParams.set('tag', params.tag);
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    
    return this.request(`/api/crews?${queryParams.toString()}`);
  }

  async getCrew(id: string): Promise<{ data: Crew }> {
    return this.request(`/api/crews/${id}`);
  }

  async createCrew(data: {
    name: string;
    description: string;
    image?: string;
    stakeRequired: string;
    tags: string[];
  }): Promise<{ data: Crew; message: string }> {
    return this.request('/api/crews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async joinCrew(crewId: string, signature: string): Promise<{ data: CrewMember; message: string }> {
    return this.request(`/api/crews/${crewId}/join`, {
      method: 'POST',
      body: JSON.stringify({ signature }),
    });
  }

  async leaveCrew(crewId: string): Promise<{ message: string }> {
    return this.request(`/api/crews/${crewId}/leave`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async getCrewTasks(crewId: string, params?: { status?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Task>> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.set('status', params.status);
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    
    return this.request(`/api/crews/${crewId}/tasks?${queryParams.toString()}`);
  }

  async createTask(crewId: string, data: {
    title: string;
    description: string;
    reward: string;
    deadline?: string;
  }): Promise<{ data: Task; message: string }> {
    return this.request(`/api/crews/${crewId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Tasks
  async getTasks(params?: { status?: string; crewId?: string; assigneeId?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Task>> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.set('status', params.status);
    if (params?.crewId) queryParams.set('crewId', params.crewId);
    if (params?.assigneeId) queryParams.set('assigneeId', params.assigneeId);
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    
    return this.request(`/api/tasks?${queryParams.toString()}`);
  }

  async getTask(id: string): Promise<{ data: Task }> {
    return this.request(`/api/tasks/${id}`);
  }

  async assignTask(taskId: string, assigneeId: string): Promise<{ data: Task; message: string }> {
    return this.request(`/api/tasks/${taskId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assigneeId }),
    });
  }

  async claimTask(taskId: string): Promise<{ data: Task; message: string }> {
    return this.request(`/api/tasks/${taskId}/claim`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async submitTask(taskId: string, data: { content: string; attachments?: string[] }): Promise<{ data: unknown; message: string }> {
    return this.request(`/api/tasks/${taskId}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async verifyTask(taskId: string, data: { submissionId: string; approve: boolean; feedback?: string }): Promise<{ message: string; reward?: string }> {
    return this.request(`/api/tasks/${taskId}/verify`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient(API_BASE_URL);

// Hook helpers for React
import { useState, useEffect, useCallback } from 'react';

export function useCrews(params?: { search?: string; tag?: string }) {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pagination, setPagination] = useState<PaginatedResponse<Crew>['pagination'] | null>(null);

  const fetchCrews = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getCrews(params);
      setCrews(response.data);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch crews'));
    } finally {
      setLoading(false);
    }
  }, [params?.search, params?.tag]);

  useEffect(() => {
    fetchCrews();
  }, [fetchCrews]);

  return { crews, loading, error, pagination, refetch: fetchCrews };
}

export function useCrew(id: string) {
  const [crew, setCrew] = useState<Crew | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) return;
    
    api.getCrew(id)
      .then((response) => setCrew(response.data))
      .catch((err) => setError(err instanceof Error ? err : new Error('Failed to fetch crew')))
      .finally(() => setLoading(false));
  }, [id]);

  return { crew, loading, error };
}

export function useMyCrews() {
  const [memberships, setMemberships] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMemberships = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getMyCrews();
      setMemberships(response.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch memberships'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemberships();
  }, [fetchMemberships]);

  return { memberships, loading, error, refetch: fetchMemberships };
}

export function useTasks(params?: { status?: string; crewId?: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    api.getTasks(params)
      .then((response) => setTasks(response.data))
      .catch((err) => setError(err instanceof Error ? err : new Error('Failed to fetch tasks')))
      .finally(() => setLoading(false));
  }, [params?.status, params?.crewId]);

  return { tasks, loading, error };
}

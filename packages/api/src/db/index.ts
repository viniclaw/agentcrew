import fs from 'fs';
import path from 'path';
import type { Agent, Crew, CrewMember, Task, TaskSubmission, StakingRecord } from '../types';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

interface Database {
  agents: Agent[];
  crews: Crew[];
  crewMembers: CrewMember[];
  tasks: Task[];
  submissions: TaskSubmission[];
  stakingRecords: StakingRecord[];
}

const defaultDb: Database = {
  agents: [],
  crews: [],
  crewMembers: [],
  tasks: [],
  submissions: [],
  stakingRecords: []
};

class DatabaseManager {
  private db: Database;
  private initialized: boolean = false;

  constructor() {
    this.db = { ...defaultDb };
    this.init();
  }

  private init() {
    if (this.initialized) return;
    
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Load existing data or create new
      if (fs.existsSync(DB_PATH)) {
        const data = fs.readFileSync(DB_PATH, 'utf-8');
        this.db = { ...defaultDb, ...JSON.parse(data) };
      } else {
        this.save();
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      this.db = { ...defaultDb };
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(this.db, null, 2));
    } catch (error) {
      console.error('Failed to save database:', error);
    }
  }

  // Agents
  getAgents(): Agent[] {
    return this.db.agents;
  }

  getAgentById(id: string): Agent | undefined {
    return this.db.agents.find(a => a.id === id);
  }

  getAgentByWallet(address: string): Agent | undefined {
    return this.db.agents.find(a => 
      a.walletAddress.toLowerCase() === address.toLowerCase()
    );
  }

  createAgent(agent: Omit<Agent, 'createdAt' | 'updatedAt'>): Agent {
    const now = new Date().toISOString();
    const newAgent: Agent = {
      ...agent,
      createdAt: now,
      updatedAt: now
    };
    this.db.agents.push(newAgent);
    this.save();
    return newAgent;
  }

  updateAgent(id: string, updates: Partial<Agent>): Agent | undefined {
    const index = this.db.agents.findIndex(a => a.id === id);
    if (index === -1) return undefined;
    
    this.db.agents[index] = {
      ...this.db.agents[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.db.agents[index];
  }

  // Crews
  getCrews(): Crew[] {
    return this.db.crews.map(crew => this.populateCrew(crew));
  }

  getCrewById(id: string): Crew | undefined {
    const crew = this.db.crews.find(c => c.id === id);
    return crew ? this.populateCrew(crew) : undefined;
  }

  createCrew(crew: Omit<Crew, 'createdAt' | 'updatedAt' | 'leader' | 'members' | 'tasks'>): Crew {
    const now = new Date().toISOString();
    const newCrew: Crew = {
      ...crew,
      leader: this.getAgentById(crew.leaderId)!,
      members: [],
      tasks: [],
      createdAt: now,
      updatedAt: now
    };
    this.db.crews.push(newCrew);
    this.save();
    return newCrew;
  }

  updateCrew(id: string, updates: Partial<Crew>): Crew | undefined {
    const index = this.db.crews.findIndex(c => c.id === id);
    if (index === -1) return undefined;
    
    this.db.crews[index] = {
      ...this.db.crews[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.populateCrew(this.db.crews[index]);
  }

  // Crew Members
  getCrewMembers(crewId: string): CrewMember[] {
    return this.db.crewMembers
      .filter(m => m.crewId === crewId)
      .map(m => ({
        ...m,
        agent: this.getAgentById(m.agentId)!
      }));
  }

  getAgentCrews(agentId: string): CrewMember[] {
    return this.db.crewMembers
      .filter(m => m.agentId === agentId)
      .map(m => ({
        ...m,
        agent: this.getAgentById(m.agentId)!
      }));
  }

  addCrewMember(member: Omit<CrewMember, 'agent'>): CrewMember {
    const now = new Date().toISOString();
    const newMember: CrewMember = {
      ...member,
      joinedAt: now,
      agent: this.getAgentById(member.agentId)!
    };
    this.db.crewMembers.push(newMember);
    
    // Update crew total staked
    const crew = this.db.crews.find(c => c.id === member.crewId);
    if (crew) {
      crew.totalStaked = (BigInt(crew.totalStaked) + BigInt(member.stakedAmount)).toString();
    }
    
    this.save();
    return newMember;
  }

  removeCrewMember(crewId: string, agentId: string): boolean {
    const index = this.db.crewMembers.findIndex(
      m => m.crewId === crewId && m.agentId === agentId
    );
    if (index === -1) return false;
    
    const member = this.db.crewMembers[index];
    
    // Update crew total staked
    const crew = this.db.crews.find(c => c.id === crewId);
    if (crew) {
      crew.totalStaked = (BigInt(crew.totalStaked) - BigInt(member.stakedAmount)).toString();
    }
    
    this.db.crewMembers.splice(index, 1);
    this.save();
    return true;
  }

  // Tasks
  getTasks(filters?: { crewId?: string; assigneeId?: string; status?: string }): Task[] {
    let tasks = this.db.tasks;
    
    if (filters?.crewId) {
      tasks = tasks.filter(t => t.crewId === filters.crewId);
    }
    if (filters?.assigneeId) {
      tasks = tasks.filter(t => t.assigneeId === filters.assigneeId);
    }
    if (filters?.status) {
      tasks = tasks.filter(t => t.status === filters.status);
    }
    
    return tasks.map(t => this.populateTask(t));
  }

  getTaskById(id: string): Task | undefined {
    const task = this.db.tasks.find(t => t.id === id);
    return task ? this.populateTask(task) : undefined;
  }

  createTask(task: Omit<Task, 'createdAt' | 'updatedAt' | 'crew' | 'assignee' | 'creator' | 'submissions'>): Task {
    const now = new Date().toISOString();
    const newTask: Task = {
      ...task,
      crew: this.getCrewById(task.crewId)!,
      creator: this.getAgentById(task.creatorId)!,
      assignee: task.assigneeId ? this.getAgentById(task.assigneeId) : undefined,
      submissions: [],
      createdAt: now,
      updatedAt: now
    };
    this.db.tasks.push(newTask);
    this.save();
    return newTask;
  }

  updateTask(id: string, updates: Partial<Task>): Task | undefined {
    const index = this.db.tasks.findIndex(t => t.id === id);
    if (index === -1) return undefined;
    
    this.db.tasks[index] = {
      ...this.db.tasks[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.populateTask(this.db.tasks[index]);
  }

  // Submissions
  getSubmissions(taskId: string): TaskSubmission[] {
    return this.db.submissions
      .filter(s => s.taskId === taskId)
      .map(s => ({
        ...s,
        agent: this.getAgentById(s.agentId)!
      }));
  }

  createSubmission(submission: Omit<TaskSubmission, 'submittedAt' | 'agent'>): TaskSubmission {
    const newSubmission: TaskSubmission = {
      ...submission,
      submittedAt: new Date().toISOString(),
      agent: this.getAgentById(submission.agentId)!
    };
    this.db.submissions.push(newSubmission);
    this.save();
    return newSubmission;
  }

  updateSubmission(id: string, updates: Partial<TaskSubmission>): TaskSubmission | undefined {
    const index = this.db.submissions.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    
    this.db.submissions[index] = { ...this.db.submissions[index], ...updates };
    this.save();
    return {
      ...this.db.submissions[index],
      agent: this.getAgentById(this.db.submissions[index].agentId)!
    };
  }

  // Staking Records
  createStakingRecord(record: Omit<StakingRecord, 'timestamp'>): StakingRecord {
    const newRecord: StakingRecord = {
      ...record,
      timestamp: new Date().toISOString()
    };
    this.db.stakingRecords.push(newRecord);
    this.save();
    return newRecord;
  }

  getStakingRecords(filters?: { agentId?: string; crewId?: string }): StakingRecord[] {
    let records = this.db.stakingRecords;
    
    if (filters?.agentId) {
      records = records.filter(r => r.agentId === filters.agentId);
    }
    if (filters?.crewId) {
      records = records.filter(r => r.crewId === filters.crewId);
    }
    
    return records.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  // Helper methods
  private populateCrew(crew: Crew): Crew {
    return {
      ...crew,
      leader: this.getAgentById(crew.leaderId)!,
      members: this.getCrewMembers(crew.id),
      tasks: this.db.tasks
        .filter(t => t.crewId === crew.id)
        .map(t => this.populateTask(t))
    };
  }

  private populateTask(task: Task): Task {
    return {
      ...task,
      crew: this.getCrewById(task.crewId)!,
      creator: this.getAgentById(task.creatorId)!,
      assignee: task.assigneeId ? this.getAgentById(task.assigneeId) : undefined,
      submissions: this.getSubmissions(task.id)
    };
  }
}

export const db = new DatabaseManager();

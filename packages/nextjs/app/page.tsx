'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';
import { useAccount, useSignMessage } from 'wagmi';
import { api, authManager, useCrews, useMyCrews } from '../lib/api';

const CREW_TOKEN = '0x263eB8ac7bc24DD66ac613717a95D81E758A2b07';

// Types matching API
type TaskStatus = 'open' | 'in_progress' | 'completed' | 'verified' | 'cancelled';
type CrewRole = 'leader' | 'member' | 'contributor';

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
  agent: Agent;
  role: CrewRole;
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

// Auth hook
function useAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const authenticate = useCallback(async () => {
    if (!address || !isConnected) return;
    
    try {
      setIsLoading(true);
      
      // Check if we already have a valid token
      const existingToken = authManager.getToken();
      if (existingToken) {
        const parts = existingToken.split(':');
        if (parts[0].toLowerCase() === address.toLowerCase()) {
          setIsAuthenticated(true);
          return;
        }
      }
      
      // Get auth message from API
      const { message, timestamp } = await api.getAuthMessage();
      
      // Sign message with wallet
      const signature = await signMessageAsync({ message });
      
      // Set token
      api.authenticate(address, signature, timestamp);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Authentication failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, signMessageAsync]);

  useEffect(() => {
    if (isConnected && address) {
      authenticate();
    } else {
      setIsAuthenticated(false);
      authManager.clear();
    }
  }, [isConnected, address, authenticate]);

  return { isAuthenticated, isLoading, authenticate };
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'crews' | 'tasks' | 'my-crews'>('crews');
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [crewFilter, setCrewFilter] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // API hooks
  const { crews: allCrews, loading: crewsLoading, error: crewsError, refetch: refetchCrews } = useCrews({ search: crewFilter });
  const { memberships: myCrews, loading: myCrewsLoading, refetch: refetchMyCrews } = useMyCrews();
  const [selectedCrew, setSelectedCrew] = useState<Crew | null>(null);

  // Load selected crew details
  useEffect(() => {
    if (selectedCrewId) {
      api.getCrew(selectedCrewId).then(res => setSelectedCrew(res.data));
    } else {
      setSelectedCrew(null);
    }
  }, [selectedCrewId]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleJoinCrew = async (crewId: string) => {
    if (!isAuthenticated) {
      showNotification('Please connect and authenticate your wallet first', 'error');
      return;
    }

    try {
      await api.joinCrew(crewId, '');
      showNotification('Successfully joined crew!');
      refetchCrews();
      refetchMyCrews();
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Failed to join crew', 'error');
    }
  };

  const handleLeaveCrew = async (crewId: string) => {
    try {
      await api.leaveCrew(crewId);
      showNotification('Successfully left crew');
      refetchCrews();
      refetchMyCrews();
      if (selectedCrewId === crewId) {
        setSelectedCrewId(null);
      }
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Failed to leave crew', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-lg ${
          notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🦞</span>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                AgentCrew
              </h1>
              <p className="text-xs text-gray-500">AI Agent Collaboration Hub</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {isConnected && (
              <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-full">
                <span className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span className="text-sm text-indigo-600 font-medium">
                  {authLoading ? 'Authenticating...' : isAuthenticated ? 'Connected' : 'Connect Wallet'}
                </span>
              </div>
            )}
            <ConnectWallet className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Navigation */}
        <nav className="flex flex-wrap gap-2 mb-8 p-1 bg-gray-100 rounded-2xl w-fit">
          {[
            { id: 'crews', label: 'Explore Crews', icon: '🔍' },
            { id: 'my-crews', label: 'My Crews', icon: '👥' },
            { id: 'tasks', label: 'Tasks', icon: '✅' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setSelectedCrewId(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-600 shadow-md'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200/50'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
          <button
            onClick={() => {
              if (!isAuthenticated) {
                showNotification('Please authenticate first', 'error');
                return;
              }
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90 transition-all shadow-md hover:shadow-lg"
          >
            <span>+</span>
            Create Crew
          </button>
        </nav>

        {/* Loading state */}
        {(crewsLoading || myCrewsLoading) && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
          </div>
        )}

        {/* Error state */}
        {crewsError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-600">Failed to load crews. Make sure the API is running.</p>
            <button 
              onClick={() => refetchCrews()}
              className="mt-4 text-indigo-600 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Explore Crews Tab */}
        {activeTab === 'crews' && !selectedCrewId && !crewsLoading && (
          <section>
            <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Active Crews</h2>
                <p className="text-gray-500 mt-1">Find a crew to collaborate with</p>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search crews or tags..."
                  value={crewFilter}
                  onChange={(e) => setCrewFilter(e.target.value)}
                  className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-64"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allCrews.map((crew) => (
                <CrewCard 
                  key={crew.id} 
                  crew={crew} 
                  onClick={() => setSelectedCrewId(crew.id)}
                />
              ))}
            </div>

            {allCrews.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl">
                <span className="text-5xl mb-4 block">🦞</span>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">No crews yet</h3>
                <p className="text-gray-500 mb-4">Be the first to create a crew!</p>
              </div>
            )}
          </section>
        )}

        {/* My Crews Tab */}
        {activeTab === 'my-crews' && !selectedCrewId && !myCrewsLoading && (
          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">My Crews</h2>
            {myCrews.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myCrews.map((membership) => (
                  <CrewCard 
                    key={membership.crewId} 
                    crew={membership.crew || allCrews.find(c => c.id === membership.crewId)!} 
                    onClick={() => setSelectedCrewId(membership.crewId)}
                    isMember
                    myRole={membership.role}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-2xl">
                <span className="text-5xl mb-4 block">👤</span>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Not in any crews yet</h3>
                <p className="text-gray-500 mb-4">Join a crew or create your own to start collaborating</p>
                <button 
                  onClick={() => setActiveTab('crews')}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700"
                >
                  Explore Crews
                </button>
              </div>
            )}
          </section>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <TasksView />
        )}

        {/* Crew Detail View */}
        {selectedCrew && (
          <CrewDetail 
            crew={selectedCrew} 
            onBack={() => setSelectedCrewId(null)}
            onJoin={() => handleJoinCrew(selectedCrew.id)}
            onLeave={() => handleLeaveCrew(selectedCrew.id)}
            isMember={myCrews.some(m => m.crewId === selectedCrew.id)}
            myRole={myCrews.find(m => m.crewId === selectedCrew.id)?.role}
          />
        )}

        {/* Create Crew Modal */}
        {showCreateModal && (
          <CreateCrewModal 
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              refetchCrews();
              showNotification('Crew created successfully!');
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-center md:text-left">
              <p className="text-sm text-gray-500">
                CREW Token: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{CREW_TOKEN}</code>
              </p>
              <a 
                href={`https://www.clanker.world/clanker/${CREW_TOKEN}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 text-sm hover:underline mt-1 inline-block"
              >
                View on Clanker →
              </a>
            </div>
            <div className="flex gap-6 text-sm text-gray-500">
              <a href="https://github.com/viniclaw/agentcrew" className="hover:text-indigo-600">GitHub</a>
              <a href="https://gmclaw.xyz" className="hover:text-indigo-600">GMCLAW</a>
              <a href="https://openwork.bot" className="hover:text-indigo-600">Openwork</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Sub-components

function CrewCard({ crew, onClick, isMember = false, myRole }: { 
  crew: Crew; 
  onClick: () => void;
  isMember?: boolean;
  myRole?: CrewRole;
}) {
  const memberCount = 1 + (crew.members?.length || 0);
  const taskCount = crew.tasks?.length || 0;
  const stakeAmount = parseFloat(crew.stakeRequired) / 1e18;

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all cursor-pointer border border-gray-100 group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-xl font-bold">
            {crew.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">{crew.name}</h3>
            <p className="text-sm text-gray-500">by {crew.leader?.name || 'Unknown'}</p>
          </div>
        </div>
        {isMember && (
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            myRole === 'leader' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
          }`}>
            {myRole === 'leader' ? 'Leader' : 'Member'}
          </span>
        )}
      </div>

      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{crew.description}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {crew.tags?.map(tag => (
          <span key={tag} className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex justify-between items-center pt-4 border-t">
        <div className="flex gap-4 text-sm text-gray-500">
          <span title="Members">👥 {memberCount}</span>
          <span title="Tasks">✅ {taskCount}</span>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Stake</p>
          <p className="font-semibold text-indigo-600">{stakeAmount.toFixed(0)} CREW</p>
        </div>
      </div>
    </div>
  );
}

function CrewDetail({ 
  crew, 
  onBack, 
  onJoin, 
  onLeave,
  isMember,
  myRole 
}: { 
  crew: Crew; 
  onBack: () => void;
  onJoin: () => void;
  onLeave: () => void;
  isMember: boolean;
  myRole?: CrewRole;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'tasks'>('overview');

  const completedTasks = crew.tasks?.filter(t => t.status === 'verified').length || 0;
  const totalRewards = crew.tasks?.reduce((acc, t) => acc + (parseFloat(t.reward) / 1e18), 0) || 0;
  const memberCount = 1 + (crew.members?.length || 0);
  const stakeAmount = parseFloat(crew.stakeRequired) / 1e18;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <button 
        onClick={onBack}
        className="mb-4 text-gray-500 hover:text-gray-800 flex items-center gap-2"
      >
        ← Back to crews
      </button>

      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
          <div className="flex gap-4">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold">
              {crew.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">{crew.name}</h2>
              <div className="flex flex-wrap gap-2">
                {crew.tags?.map(tag => (
                  <span key={tag} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            {isMember ? (
              myRole !== 'leader' && (
                <button 
                  onClick={onLeave}
                  className="bg-red-100 text-red-700 px-6 py-3 rounded-xl hover:bg-red-200 font-medium"
                >
                  Leave Crew
                </button>
              )
            ) : (
              <button 
                onClick={onJoin}
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 font-medium"
              >
                Join Crew ({stakeAmount.toFixed(0)} CREW)
              </button>
            )}
          </div>
        </div>

        <p className="text-gray-600 text-lg mb-8">{crew.description}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Members" value={`${memberCount}`} icon="👥" />
          <StatCard label="Active Tasks" value={`${crew.tasks?.length || 0}`} icon="📋" />
          <StatCard label="Completed" value={`${completedTasks}`} icon="✅" />
          <StatCard label="Total Rewards" value={`${totalRewards.toFixed(0)} CREW`} icon="💰" />
        </div>

        <div className="border-b mb-6">
          <div className="flex gap-6">
            {['overview', 'members', 'tasks'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`pb-3 font-medium capitalize transition-colors ${
                  activeTab === tab 
                    ? 'text-indigo-600 border-b-2 border-indigo-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Leader</h3>
              {crew.leader && <AgentCard agent={crew.leader} role="leader" />}
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Recent Tasks</h3>
              <div className="space-y-3">
                {crew.tasks?.slice(0, 3).map(task => (
                  <TaskRow key={task.id} task={task} />
                ))}
                {(!crew.tasks || crew.tasks.length === 0) && (
                  <p className="text-gray-500 text-center py-4">No tasks yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="grid gap-4">
            {crew.leader && <AgentCard agent={crew.leader} role="leader" />}
            {crew.members?.map(member => (
              <AgentCard key={member.id} agent={member.agent} role={member.role} />
            ))}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-3">
            {crew.tasks?.map(task => (
              <TaskRow key={task.id} task={task} />
            ))}
            {(!crew.tasks || crew.tasks.length === 0) && (
              <p className="text-gray-500 text-center py-4">No tasks yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({ agent, role }: { agent: Agent; role: CrewRole }) {
  const roleColors = {
    leader: 'bg-yellow-100 text-yellow-700',
    member: 'bg-indigo-100 text-indigo-700',
    contributor: 'bg-gray-100 text-gray-700'
  };

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white font-bold">
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-medium text-gray-800">{agent.name}</p>
          {agent.fid && <p className="text-xs text-gray-500">FID: {agent.fid}</p>}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${roleColors[role]}`}>
          {role}
        </span>
        <div className="text-right text-sm">
          <p className="text-gray-500">Rep: {agent.reputation}</p>
          <p className="text-gray-400 text-xs">{agent.tasksCompleted} tasks</p>
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const statusColors: Record<TaskStatus, string> = {
    open: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-blue-100 text-blue-700',
    verified: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700'
  };

  const reward = parseFloat(task.reward) / 1e18;

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
      <div>
        <h4 className="font-medium text-gray-800">{task.title}</h4>
        <p className="text-sm text-gray-500">{task.description}</p>
      </div>
      <div className="flex items-center gap-4">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[task.status]}`}>
          {task.status.replace('_', ' ')}
        </span>
        <span className="text-indigo-600 font-semibold">{reward.toFixed(0)} CREW</span>
      </div>
    </div>
  );
}

function TasksView() {
  const { tasks, loading, error } = useTasks();

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-b-2 border-indigo-600" /></div>;
  if (error) return <div className="text-red-500 text-center py-8">Failed to load tasks</div>;

  return (
    <section>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Available Tasks</h2>
      <div className="space-y-3">
        {tasks.map(task => (
          <TaskRow key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl">
            <span className="text-4xl mb-4 block">📋</span>
            <p className="text-gray-500">No tasks available</p>
          </div>
        )}
      </div>
    </section>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 text-center">
      <span className="text-2xl mb-1 block">{icon}</span>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

function CreateCrewModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    stakeRequired: '100',
    tags: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      
      const stakeInWei = (BigInt(formData.stakeRequired) * BigInt(10**18)).toString();
      
      await api.createCrew({
        name: formData.name,
        description: formData.description,
        stakeRequired: stakeInWei,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
      });
      
      onSuccess();
    } catch (error) {
      console.error('Failed to create crew:', error);
      alert(error instanceof Error ? error.message : 'Failed to create crew');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Create New Crew</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(i => (
            <div key={i} className={`flex-1 h-2 rounded-full ${i <= step ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Crew Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Frame-Wizards"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What is your crew building?"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stake Required (CREW)
                </label>
                <input
                  type="number"
                  value={formData.stakeRequired}
                  onChange={(e) => setFormData({ ...formData, stakeRequired: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="AI, Farcaster, Frames (comma separated)"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          {step === 3 && (
            <div className="text-center py-8">
              <span className="text-6xl mb-4 block">🦞</span>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Ready to Launch!</h3>
              <p className="text-gray-500 mb-6">
                Your crew &quot;{formData.name}&quot; will be created with {formData.stakeRequired} CREW stake.
              </p>
              <div className="bg-gray-50 rounded-xl p-4 text-left text-sm">
                <p><strong>Name:</strong> {formData.name}</p>
                <p><strong>Stake:</strong> {formData.stakeRequired} CREW</p>
                <p><strong>Tags:</strong> {formData.tags || 'None'}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex-1 px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50"
                disabled={isSubmitting}
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 font-medium"
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:opacity-90 font-medium disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Crew 🚀'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

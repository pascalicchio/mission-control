'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { playSound } from '@/lib/sounds';

// Types
interface Task {
  id: string;
  title: string;
  status: 'pending' | 'executing' | 'done' | 'failed';
  priority: 'normal' | 'rush';
  agent?: string;
  result?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  duration?: number;
  interactions?: any[];
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  status: 'idle' | 'executing' | 'offline';
  current_task?: string;
  last_active: string;
  mood: 'happy' | 'neutral' | 'stressed';
  task_count: number;
  success_rate: number;
}

interface Activity {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  duration?: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [newTask, setNewTask] = useState('');
  const [priority, setPriority] = useState<'normal' | 'rush'>('normal');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'executing' | 'done'>('all');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  // Check auth
  useEffect(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('mission_token='));
    if (!token) {
      router.push('/login');
    } else {
      setAuthenticated(true);
      loadData();
      initSocket();
    }
    setLoading(false);
  }, [router]);

  const loadData = async () => {
    try {
      const [tasksRes, analyticsRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/analytics'),
      ]);
      const tasksData = await tasksRes.json();
      const analyticsData = await analyticsRes.json();
      setTasks(tasksData.tasks || []);
      setAgents(tasksData.agents || []);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const fetchTaskDetails = async (task: Task) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`);
      const data = await res.json();
      setSelectedTask(data.task);
    } catch (error) {
      console.error('Failed to fetch task details:', error);
      setSelectedTask(task);
    }
  };

  const initSocket = useCallback(() => {
    if (socket) return; // Already connected
    
    const socketIo = io({
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketIo.on('connect', () => {
      console.log('🔌 Socket connected');
      socketIo.emit('subscribe', 'tasks');
      socketIo.emit('subscribe', 'agents');
      socketIo.emit('subscribe', 'activity');
    });

    socketIo.on('task:created', (task: Task) => {
      setTasks(prev => {
        if (prev.find(t => t.id === task.id)) return prev;
        return [task, ...prev];
      });
    });

    socketIo.on('task:updated', (task: Task) => {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    });

    socketIo.on('task:completed', (task: Task) => {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
      playSound('complete');
    });

    socketIo.on('task:deleted', ({ id }: { id: string }) => {
      setTasks(prev => prev.filter(t => t.id !== id));
    });

    socketIo.on('agent:update', (agentsData: Agent[]) => {
      setAgents(agentsData);
    });

    socketIo.on('activity:new', (activity: Activity) => {
      setActivities(prev => [activity, ...prev].slice(0, 50));
    });

    setSocket(socketIo);

    return () => {
      socketIo.disconnect();
    };
  }, []);

  const handleLogout = () => {
    document.cookie = 'mission_token=; path=/; max-age=0';
    router.push('/login');
  };

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTask, priority }),
      });

      const data = await res.json();
      if (data.success) {
        setNewTask('');
      }
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    
    try {
      await fetch(`/api/tasks?id=${taskId}`, { method: 'DELETE' });
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setSelectedTask(null);
      playSound('notification');
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const reRunTask = async (task: Task) => {
    try {
      // Create new task with same title
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: task.title, priority: task.priority }),
      });
      
      const data = await res.json();
      if (data.success) {
        setSelectedTask(null);
        // Trigger execution
        await fetch('/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task: task.title, taskId: data.task.id }),
        });
        playSound('notification');
      }
    } catch (error) {
      console.error('Failed to re-run task:', error);
    }
  };

  const filteredTasks = tasks.filter(t => filter === 'all' || t.status === filter);
  const tasksByStatus = {
    pending: tasks.filter(t => t.status === 'pending'),
    executing: tasks.filter(t => t.status === 'executing'),
    done: tasks.filter(t => t.status === 'done'),
    failed: tasks.filter(t => t.status === 'failed'),
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Initializing Mission Control...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-gradient flex items-center justify-center">
              <span className="text-xl">🕶️</span>
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">Mission Control 2.0</h1>
              <p className="text-xs text-gray-500">Real-time AI Agent Command Center</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${socket?.connected ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              <span className={`w-2 h-2 rounded-full ${socket?.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className={`text-xs ${socket?.connected ? 'text-green-400' : 'text-red-400'}`}>
                {socket?.connected ? 'WebSocket Active' : 'Connecting...'}
              </span>
            </div>
            <button onClick={handleLogout} className="glass-button text-sm">
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      <div className="flex max-w-[1800px] mx-auto">
        {/* Agent Sidebar */}
        <aside className="w-72 fixed left-0 top-20 bottom-0 bg-glass-100 backdrop-blur-xl border-r border-white/5 overflow-y-auto p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Agent Squad</h2>
          <div className="space-y-2">
            {agents.map(agent => (
              <div key={agent.id} className="glass-card-hover p-3 flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-xl ${agent.status === 'executing' ? 'animate-pulse' : ''}`}>
                    {agent.emoji}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#0a0a0f] ${
                    agent.status === 'idle' ? 'bg-green-500' : 
                    agent.status === 'executing' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'
                  }`}></span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{agent.name}</span>
                    {agent.status === 'executing' && (
                      <span className="text-xs text-blue-400">⚡</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {agent.status === 'executing' ? agent.current_task : `${agent.task_count} tasks • ${agent.success_rate}% success`}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Agent Stats */}
          <div className="mt-6 pt-6 border-t border-white/5">
            <h3 className="text-xs font-semibold text-gray-400 mb-3">Squad Stats</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="glass-card p-3 text-center">
                <div className="text-xl font-bold text-purple-400">{agents.reduce((a, b) => a + b.task_count, 0)}</div>
                <div className="text-xs text-gray-500">Total Tasks</div>
              </div>
              <div className="glass-card p-3 text-center">
                <div className="text-xl font-bold text-green-400">{Math.round(agents.reduce((a, b) => a + b.success_rate, 0) / agents.length)}%</div>
                <div className="text-xs text-gray-500">Avg Success</div>
              </div>
            </div>
          </div>

          {/* Agent Rankings */}
          <div className="mt-6 pt-6 border-t border-white/5">
            <h3 className="text-xs font-semibold text-gray-400 mb-3">🏆 Top Agents</h3>
            <div className="space-y-2">
              {agents
                .sort((a, b) => b.success_rate - a.success_rate)
                .slice(0, 5)
                .map((agent, i) => (
                  <div key={agent.id} className="flex items-center gap-2 p-2 glass-card">
                    <span className={`text-xs font-bold w-5 ${
                      i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-500'
                    }`}>
                      #{i + 1}
                    </span>
                    <span className="text-sm">{agent.emoji}</span>
                    <span className="text-xs flex-1 truncate">{agent.name}</span>
                    <span className={`text-xs font-semibold ${
                      agent.success_rate >= 90 ? 'text-green-400' : 
                      agent.success_rate >= 80 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {agent.success_rate}%
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="mt-6 pt-6 border-t border-white/5">
            <h3 className="text-xs font-semibold text-gray-400 mb-3">📋 Live Activity</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activities.slice(0, 10).map((activity, i) => (
                <div key={activity.id || i} className="text-xs text-gray-400 p-2 glass-card">
                  <p className="truncate">{activity.message}</p>
                  <p className="text-gray-600">{new Date(activity.timestamp).toLocaleTimeString()}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-72 p-6">
          {/* Quick Actions */}
          <div className="glass-card p-3 mb-4">
            <div className="text-xs text-gray-400 mb-2">⚡ Quick Actions</div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '📝 Research', task: 'research AI trends' },
                { label: '🐦 Post to X', task: 'post to X about build in public' },
                { label: '✍️ Blog', task: 'blog about AI automation' },
                { label: '💻 Build', task: 'build a simple landing page' },
                { label: '🔍 Analyze', task: 'analyze competitor strategy' },
                { label: '📊 Report', task: 'create weekly performance report' },
              ].map((action) => (
                <button
                  key={action.task}
                  onClick={() => setNewTask(action.task)}
                  className="px-3 py-1.5 glass-button text-xs hover:bg-purple-500/20 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Task Input */}
          <div className="glass-card p-4 mb-6">
            <form onSubmit={submitTask} className="flex items-center gap-3">
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Enter a mission for your agent squad..."
                className="flex-1 h-10 px-4 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all"
              />
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'normal' | 'rush')}
                className="h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50 cursor-pointer"
              >
                <option value="normal">Normal</option>
                <option value="rush">🔴 Rush</option>
              </select>
              <button type="submit" className="h-10 px-6 rounded-lg bg-purple-gradient text-white font-medium text-sm whitespace-nowrap hover:opacity-90 transition-opacity">
                🚀 Launch
              </button>
            </form>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Total Missions</span>
                <span className="text-2xl font-bold gradient-text">{tasks.length}</span>
              </div>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Pending</span>
                <span className="text-2xl font-bold text-yellow-400">{tasksByStatus.pending.length}</span>
              </div>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Executing</span>
                <span className="text-2xl font-bold text-blue-400">{tasksByStatus.executing.length}</span>
              </div>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Completed</span>
                <span className="text-2xl font-bold text-green-400">{tasksByStatus.done.length}</span>
              </div>
            </div>
          </div>

          {/* Analytics Panel */}
          {analytics && (
            <div className="glass-card p-4 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-purple-400">📊 Performance Analytics</h3>
                <button onClick={loadData} className="text-xs text-gray-400 hover:text-white">↻ Refresh</button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="glass-card p-3 text-center">
                  <div className="text-lg font-bold text-purple-400">{analytics.metrics?.successRate || 0}%</div>
                  <div className="text-xs text-gray-500">Success Rate</div>
                </div>
                <div className="glass-card p-3 text-center">
                  <div className="text-lg font-bold text-blue-400">{analytics.metrics?.avgDuration || 0}s</div>
                  <div className="text-xs text-gray-500">Avg Duration</div>
                </div>
                <div className="glass-card p-3 text-center">
                  <div className="text-lg font-bold text-green-400">{analytics.metrics?.completedTasks || 0}</div>
                  <div className="text-xs text-gray-500">Completed</div>
                </div>
                <div className="glass-card p-3 text-center">
                  <div className="text-lg font-bold text-red-400">{analytics.metrics?.failedTasks || 0}</div>
                  <div className="text-xs text-gray-500">Failed</div>
                </div>
              </div>
              {/* Task Types */}
              {analytics.taskTypes && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="text-xs text-gray-400 mb-2">Task Types</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(analytics.taskTypes).map(([type, count]) => (
                      <span key={type} className="px-2 py-1 glass-card text-xs">
                        {type}: <span className="text-purple-400">{count as number}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-4">
            {(['all', 'pending', 'executing', 'done'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === f 
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                    : 'glass-button text-gray-400'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Kanban Board */}
          <div className="grid grid-cols-3 gap-4">
            {/* Pending Column */}
            <div className="kanban-column">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-yellow-400 flex items-center gap-2">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                  Pending
                </h3>
                <span className="text-xs text-gray-500">{tasksByStatus.pending.length}</span>
              </div>
              <div className="space-y-2">
                {tasksByStatus.pending.map(task => (
                  <div key={task.id} onClick={() => fetchTaskDetails(task)} className="task-card">
                    <div className="flex items-center gap-2 mb-2">
                      {task.priority === 'rush' && (
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full border border-red-500/30">RUSH</span>
                      )}
                      <span className="text-xs text-gray-500">{new Date(task.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm font-medium">{task.title}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Executing Column */}
            <div className="kanban-column">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-blue-400 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                  Executing
                </h3>
                <span className="text-xs text-gray-500">{tasksByStatus.executing.length}</span>
              </div>
              <div className="space-y-2">
                {tasksByStatus.executing.map(task => (
                  <div key={task.id} onClick={() => fetchTaskDetails(task)} className="task-card border-blue-500/30 bg-blue-500/5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                      <span className="text-xs text-blue-400">In Progress...</span>
                    </div>
                    <p className="text-sm font-medium">{task.title}</p>
                    {task.agent && (
                      <p className="text-xs text-gray-500 mt-1">🤖 {task.agent}</p>
                    )}
                    <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Done Column */}
            <div className="kanban-column">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-green-400 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Completed
                </h3>
                <span className="text-xs text-gray-500">{tasksByStatus.done.length}</span>
              </div>
              <div className="space-y-2">
                {tasksByStatus.done.slice(0, 5).map(task => (
                  <div key={task.id} onClick={() => fetchTaskDetails(task)} className="task-card border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-green-500">✓</span>
                      <span className="text-xs text-gray-500">{new Date(task.completed_at || task.created_at).toLocaleTimeString()}</span>
                      {task.duration && (
                        <span className="text-xs text-gray-500">• {task.duration}s</span>
                      )}
                    </div>
                    <p className="text-sm font-medium line-clamp-2">{task.title}</p>
                    {task.result && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-1">{task.result}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="modal-overlay" onClick={() => setSelectedTask(null)}>
          <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {selectedTask.priority === 'rush' && (
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full border border-red-500/30">RUSH</span>
                  )}
                  <span className={`status-badge ${
                    selectedTask.status === 'done' ? 'status-done' :
                    selectedTask.status === 'executing' ? 'status-executing' :
                    selectedTask.status === 'failed' ? 'status-failed' : 'status-pending'
                  }`}>
                    {selectedTask.status.toUpperCase()}
                  </span>
                </div>
                <h2 className="text-xl font-bold">{selectedTask.title}</h2>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            {/* Timeline */}
            <div className="glass-card p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">📅 Timeline</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Created</span>
                  <span>{new Date(selectedTask.created_at).toLocaleString()}</span>
                </div>
                {selectedTask.started_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Started</span>
                    <span>{new Date(selectedTask.started_at).toLocaleString()}</span>
                  </div>
                )}
                {selectedTask.completed_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Completed</span>
                    <span>{new Date(selectedTask.completed_at).toLocaleString()}</span>
                  </div>
                )}
                {selectedTask.duration && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Duration</span>
                    <span className="text-purple-400 font-semibold">{selectedTask.duration} seconds</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bot Interactions */}
            <div className="glass-card p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">🤖 Bot Interactions</h3>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {selectedTask.interactions?.map((interaction: any, i: number) => (
                  <div key={i} className="flex gap-3 p-2 bg-white/5 rounded-lg">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-sm">
                      🤖
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{interaction.agent}</span>
                        <span className="text-xs text-gray-500">{new Date(interaction.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-gray-400">{interaction.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Result */}
            {selectedTask.result && (
              <div className="glass-card p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">📋 Result</h3>
                <p className="text-sm text-gray-300">{selectedTask.result}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button onClick={() => selectedTask && reRunTask(selectedTask)} className="glass-button-primary flex-1">🔄 Re-run Task</button>
              <button className="glass-button flex-1">📝 Edit Task</button>
              <button onClick={() => selectedTask && deleteTask(selectedTask.id)} className="glass-button text-red-400 border-red-500/30 hover:bg-red-500/10">🗑️ Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

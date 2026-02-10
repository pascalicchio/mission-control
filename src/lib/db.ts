// In-memory database for Vercel serverless compatibility
interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  agent?: string;
  result?: string;
  conversation_id?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  duration?: number;
}

interface Interaction {
  id: number;
  task_id: string;
  agent: string;
  action: string;
  message: string;
  timestamp: string;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  status: string;
  current_task?: string;
  last_active: string;
  mood: string;
  task_count: number;
  success_rate: number;
}

interface Conversation {
  id: string;
  title: string;
  topic: string;
  status: string;
  turns: number;
  participants: string;
  created_at: string;
  updated_at: string;
}

interface ConversationMessage {
  id: number;
  conversation_id: string;
  turn: number;
  agent_id: string;
  agent_name: string;
  agent_emoji: string;
  message: string;
  timestamp: string;
}

interface ExtractedAction {
  id: number;
  conversation_id: string;
  task_id?: string;
  description: string;
  owner: string;
  category: string;
  confidence: number;
  source_agent: string;
  status: string;
}

// In-memory storage
const tasks: Map<string, Task> = new Map();
const interactions: Interaction[] = [];
const agents: Map<string, Agent> = new Map();
const conversations: Map<string, Conversation> = new Map();
const conversationMessages: ConversationMessage[] = [];
const extractedActions: ExtractedAction[] = [];

// Initialize default agents
const defaultAgents: Agent[] = [
  { id: 'loki', name: 'Loki', emoji: '🦇', status: 'idle', last_active: new Date().toISOString(), mood: 'happy', task_count: 12, success_rate: 92 },
  { id: 'wanda', name: 'Wanda', emoji: '🩸', status: 'idle', last_active: new Date().toISOString(), mood: 'neutral', task_count: 8, success_rate: 88 },
  { id: 'pulse', name: 'Pulse', emoji: '💜', status: 'idle', last_active: new Date().toISOString(), mood: 'stressed', task_count: 15, success_rate: 95 },
  { id: 'vision', name: 'Vision', emoji: '💎', status: 'idle', last_active: new Date().toISOString(), mood: 'happy', task_count: 6, success_rate: 100 },
  { id: 'friday', name: 'Friday', emoji: '🤖', status: 'idle', last_active: new Date().toISOString(), mood: 'neutral', task_count: 20, success_rate: 85 },
  { id: 'jocasta', name: 'Jocasta', emoji: '👩‍💻', status: 'idle', last_active: new Date().toISOString(), mood: 'happy', task_count: 10, success_rate: 90 },
  { id: 'fury', name: 'Fury', emoji: '👁️', status: 'idle', last_active: new Date().toISOString(), mood: 'neutral', task_count: 5, success_rate: 80 },
  { id: 'maria', name: 'Maria', emoji: '👩‍✈️', status: 'idle', last_active: new Date().toISOString(), mood: 'happy', task_count: 9, success_rate: 89 },
  { id: 'phil', name: 'Phil', emoji: '🕷️', status: 'idle', last_active: new Date().toISOString(), mood: 'happy', task_count: 14, success_rate: 93 },
  { id: 'miles', name: 'Miles', emoji: '🕸️', status: 'idle', last_active: new Date().toISOString(), mood: 'neutral', task_count: 7, success_rate: 86 },
];

// Initialize agents
defaultAgents.forEach(a => agents.set(a.id, a));

export const tasksDb = {
  getAll: () => Array.from(tasks.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  
  getById: (id: string) => tasks.get(id),
  
  addInteraction: (interaction: {
    task_id: string;
    agent: string;
    action: string;
    message: string;
    timestamp?: string;
  }) => {
    interactions.push({
      id: interactions.length + 1,
      ...interaction,
      timestamp: interaction.timestamp || new Date().toISOString(),
    });
  },
  
  create: (task: Task) => {
    tasks.set(task.id, task);
    return task;
  },
  
  update: (id: string, updates: Record<string, any>) => {
    const task = tasks.get(id);
    if (!task) return undefined;
    const updated = { ...task, ...updates };
    tasks.set(id, updated);
    return updated;
  },
  
  getInteractions: (taskId: string) => interactions.filter(i => i.task_id === taskId),
  
  delete: (id: string) => {
    tasks.delete(id);
  },
  
  clear: () => {
    tasks.clear();
    interactions.length = 0;
  },
};

export const agentsDb = {
  getAll: () => Array.from(agents.values()),
  
  getById: (id: string) => agents.get(id),
  
  update: (id: string, updates: Record<string, any>) => {
    const agent = agents.get(id);
    if (!agent) return undefined;
    const updated = { ...agent, ...updates };
    agents.set(id, updated);
    return updated;
  },
};

export const conversationsDb = {
  getAll: () => Array.from(conversations.values()).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
  
  getById: (id: string) => conversations.get(id),
  
  create: (conversation: {
    id: string;
    title: string;
    topic: string;
    participants: string;
  }) => {
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: conversation.id,
      title: conversation.title,
      topic: conversation.topic,
      participants: conversation.participants,
      status: 'active',
      turns: 0,
      created_at: now,
      updated_at: now,
    };
    conversations.set(conversation.id, conv);
    return conv;
  },
  
  addMessage: (message: {
    conversation_id: string;
    turn: number;
    agent_id: string;
    agent_name: string;
    agent_emoji: string;
    message: string;
  }) => {
    const timestamp = new Date().toISOString();
    conversationMessages.push({
      id: conversationMessages.length + 1,
      ...message,
      timestamp,
    });
    // Update conversation turns
    const conv = conversations.get(message.conversation_id);
    if (conv) {
      conv.turns = message.turn;
      conv.updated_at = timestamp;
    }
  },
  
  getMessages: (conversationId: string) => conversationMessages.filter(m => m.conversation_id === conversationId).sort((a, b) => a.turn - b.turn),
  
  close: (id: string) => {
    const conv = conversations.get(id);
    if (conv) {
      conv.status = 'closed';
    }
  },
  
  delete: (id: string) => {
    conversations.delete(id);
    // Remove associated messages and actions
    const msgIds = conversationMessages.filter(m => m.conversation_id === id).map(m => m.id);
    msgIds.forEach(mid => {
      const idx = conversationMessages.findIndex(m => m.id === mid);
      if (idx >= 0) conversationMessages.splice(idx, 1);
    });
    const actionIds = extractedActions.filter(a => a.conversation_id === id).map(a => a.id);
    actionIds.forEach(aid => {
      const idx = extractedActions.findIndex(a => a.id === aid);
      if (idx >= 0) extractedActions.splice(idx, 1);
    });
  },
};

export const extractedActionsDb = {
  getByConversation: (conversationId: string) => extractedActions.filter(a => a.conversation_id === conversationId),
  
  create: (action: {
    conversation_id: string;
    description: string;
    owner: string;
    category: string;
    confidence: number;
    source_agent: string;
  }) => {
    const newAction: ExtractedAction = {
      id: extractedActions.length + 1,
      ...action,
      task_id: undefined,
      status: 'pending',
    };
    extractedActions.push(newAction);
    return newAction;
  },
  
  updateTask: (id: string, taskId: string) => {
    const action = extractedActions.find(a => a.id === Number(id));
    if (action) {
      action.task_id = taskId;
    }
  },
  
  getPending: () => extractedActions.filter(a => a.status === 'pending'),
  
  complete: (id: string) => {
    const action = extractedActions.find(a => a.id === Number(id));
    if (action) {
      action.status = 'completed';
    }
  },
};

export default {
  tasksDb,
  agentsDb,
  conversationsDb,
  extractedActionsDb,
};

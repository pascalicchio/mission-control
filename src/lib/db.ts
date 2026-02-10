import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('/root/.openclaw/.firebase/service-account.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://mission-board-70cab.firebaseio.com',
  });
}

const db = admin.firestore();

// Interfaces
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

// Default agents
const defaultAgents: Agent[] = [
  { id: 'loki', name: 'Loki', emoji: '🦇', status: 'idle', last_active: new Date().toISOString(), mood: 'happy', task_count: 0, success_rate: 92 },
  { id: 'wanda', name: 'Wanda', emoji: '🩸', status: 'idle', last_active: new Date().toISOString(), mood: 'neutral', task_count: 0, success_rate: 88 },
  { id: 'pulse', name: 'Pulse', emoji: '💜', status: 'idle', last_active: new Date().toISOString(), mood: 'stressed', task_count: 0, success_rate: 95 },
  { id: 'vision', name: 'Vision', emoji: '💎', status: 'idle', last_active: new Date().toISOString(), mood: 'happy', task_count: 0, success_rate: 100 },
  { id: 'friday', name: 'Friday', emoji: '🤖', status: 'idle', last_active: new Date().toISOString(), mood: 'neutral', task_count: 0, success_rate: 85 },
  { id: 'jocasta', name: 'Jocasta', emoji: '👩‍💻', status: 'idle', last_active: new Date().toISOString(), mood: 'happy', task_count: 0, success_rate: 90 },
  { id: 'fury', name: 'Fury', emoji: '👁️', status: 'idle', last_active: new Date().toISOString(), mood: 'neutral', task_count: 0, success_rate: 80 },
  { id: 'maria', name: 'Maria', emoji: '👩‍✈️', status: 'idle', last_active: new Date().toISOString(), mood: 'happy', task_count: 0, success_rate: 89 },
  { id: 'phil', name: 'Phil', emoji: '🕷️', status: 'idle', last_active: new Date().toISOString(), mood: 'happy', task_count: 0, success_rate: 93 },
  { id: 'miles', name: 'Miles', emoji: '🕸️', status: 'idle', last_active: new Date().toISOString(), mood: 'neutral', task_count: 0, success_rate: 86 },
];

// Initialize agents in Firestore on first run
async function initAgents() {
  const snapshot = await db.collection('agents').count().get();
  if (snapshot.data().count === 0) {
    const batch = db.batch();
    for (const agent of defaultAgents) {
      batch.set(db.collection('agents').doc(agent.id), agent);
    }
    await batch.commit();
  }
}
initAgents().catch(console.error);

// Tasks
export const tasksDb = {
  getAll: async (): Promise<Task[]> => {
    const snapshot = await db.collection('tasks').orderBy('created_at', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
  },
  
  getById: async (id: string): Promise<Task | undefined> => {
    const doc = await db.collection('tasks').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as Task : undefined;
  },
  
  addInteraction: async (interaction: Omit<Interaction, 'id'>): Promise<void> => {
    const snapshot = await db.collection('interactions').where('task_id', '==', interaction.task_id).count().get();
    const id = snapshot.data().count + 1;
    await db.collection('interactions').add({ ...interaction, id });
  },
  
  create: async (task: Omit<Task, 'id'>): Promise<Task> => {
    const docRef = await db.collection('tasks').add(task);
    
    // Add creation interaction
    await tasksDb.addInteraction({
      task_id: docRef.id,
      agent: 'System',
      action: 'created',
      message: `Task "${task.title}" created with ${task.priority} priority`,
      timestamp: task.created_at,
    });
    
    return { id: docRef.id, ...task };
  },
  
  update: async (id: string, updates: Partial<Task>): Promise<Task | undefined> => {
    await db.collection('tasks').doc(id).update(updates);
    return tasksDb.getById(id);
  },
  
  getInteractions: async (taskId: string): Promise<Interaction[]> => {
    const snapshot = await db.collection('interactions').where('task_id', '==', taskId).orderBy('timestamp', 'asc').get();
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: parseInt(doc.id) || 0,
        task_id: data.task_id,
        agent: data.agent,
        action: data.action,
        message: data.message,
        timestamp: data.timestamp,
      } as Interaction;
    });
  },
  
  delete: async (id: string): Promise<void> => {
    await db.collection('tasks').doc(id).delete();
  },
  
  clear: async (): Promise<void> => {
    const snapshot = await db.collection('tasks').get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  },
};

// Agents
export const agentsDb = {
  getAll: async (): Promise<Agent[]> => {
    const snapshot = await db.collection('agents').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Agent));
  },
  
  getById: async (id: string): Promise<Agent | undefined> => {
    const doc = await db.collection('agents').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as Agent : undefined;
  },
  
  update: async (id: string, updates: Partial<Agent>): Promise<Agent | undefined> => {
    await db.collection('agents').doc(id).update(updates);
    return agentsDb.getById(id);
  },
};

// Conversations
export const conversationsDb = {
  getAll: async (): Promise<Conversation[]> => {
    const snapshot = await db.collection('conversations').orderBy('updated_at', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
  },
  
  getById: async (id: string): Promise<Conversation | undefined> => {
    const doc = await db.collection('conversations').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as Conversation : undefined;
  },
  
  create: async (conversation: Omit<Conversation, 'id' | 'status' | 'turns' | 'created_at' | 'updated_at'>): Promise<Conversation> => {
    const now = new Date().toISOString();
    const docRef = await db.collection('conversations').add({
      ...conversation,
      status: 'active',
      turns: 0,
      created_at: now,
      updated_at: now,
    });
    return { id: docRef.id, status: 'active', turns: 0, created_at: now, updated_at: now, ...conversation };
  },
  
  addMessage: async (message: Omit<ConversationMessage, 'id' | 'timestamp'>): Promise<void> => {
    const conv = await conversationsDb.getById(message.conversation_id);
    const timestamp = new Date().toISOString();
    
    await db.collection('conversation_messages').add({
      ...message,
      timestamp,
    });
    
    // Update conversation
    await db.collection('conversations').doc(message.conversation_id).update({
      turns: message.turn,
      updated_at: timestamp,
    });
  },
  
  getMessages: async (conversationId: string): Promise<ConversationMessage[]> => {
    const snapshot = await db.collection('conversation_messages')
      .where('conversation_id', '==', conversationId)
      .orderBy('turn', 'asc')
      .get();
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: parseInt(doc.id) || 0,
        conversation_id: data.conversation_id,
        turn: data.turn,
        agent_id: data.agent_id,
        agent_name: data.agent_name,
        agent_emoji: data.agent_emoji,
        message: data.message,
        timestamp: data.timestamp,
      } as ConversationMessage;
    });
  },
  
  close: async (id: string): Promise<void> => {
    await db.collection('conversations').doc(id).update({ status: 'closed' });
  },
  
  delete: async (id: string): Promise<void> => {
    // Delete messages
    const msgSnapshot = await db.collection('conversation_messages').where('conversation_id', '==', id).get();
    const msgBatch = db.batch();
    msgSnapshot.docs.forEach(doc => msgBatch.delete(doc.ref));
    await msgBatch.commit();
    
    // Delete actions
    const actionSnapshot = await db.collection('extracted_actions').where('conversation_id', '==', id).get();
    const actionBatch = db.batch();
    actionSnapshot.docs.forEach(doc => actionBatch.delete(doc.ref));
    await actionBatch.commit();
    
    // Delete conversation
    await db.collection('conversations').doc(id).delete();
  },
};

// Extracted Actions
export const extractedActionsDb = {
  getByConversation: async (conversationId: string): Promise<ExtractedAction[]> => {
    const snapshot = await db.collection('extracted_actions')
      .where('conversation_id', '==', conversationId)
      .orderBy('id', 'asc')
      .get();
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: parseInt(doc.id) || 0,
        conversation_id: data.conversation_id,
        task_id: data.task_id,
        description: data.description,
        owner: data.owner,
        category: data.category,
        confidence: data.confidence,
        source_agent: data.source_agent,
        status: data.status,
      } as ExtractedAction;
    });
  },
  
  create: async (action: Omit<ExtractedAction, 'id' | 'status'>): Promise<ExtractedAction> => {
    const snapshot = await db.collection('extracted_actions')
      .where('conversation_id', '==', action.conversation_id)
      .count()
      .get();
    const id = snapshot.data().count + 1;
    const docRef = await db.collection('extracted_actions').add({ ...action, status: 'pending', id });
    return { id, status: 'pending', ...action };
  },
  
  updateTask: async (id: string, taskId: string): Promise<void> => {
    await db.collection('extracted_actions').doc(id).update({ task_id: taskId, status: 'completed' });
  },
  
  getPending: async (): Promise<ExtractedAction[]> => {
    const snapshot = await db.collection('extracted_actions').where('status', '==', 'pending').get();
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: parseInt(doc.id) || 0,
        conversation_id: data.conversation_id,
        task_id: data.task_id,
        description: data.description,
        owner: data.owner,
        category: data.category,
        confidence: data.confidence,
        source_agent: data.source_agent,
        status: data.status,
      } as ExtractedAction;
    });
  },
  
  complete: async (id: string): Promise<void> => {
    await db.collection('extracted_actions').doc(id).update({ status: 'completed' });
  },
};

export default {
  tasksDb,
  agentsDb,
  conversationsDb,
  extractedActionsDb,
};

import * as admin from 'firebase-admin';

// Initialize Firebase Admin once
let adminApp: admin.app.App | null = null;
let firestore: FirebaseFirestore.Firestore | null = null;

function getFirestore(): FirebaseFirestore.Firestore {
  if (!firestore) {
    try {
      // Get credentials from environment or use inline fallback
      const projectId = process.env.FIREBASE_PROJECT_ID || 'mission-board-70cab';
      
      // For Vercel, use environment variable for private key if available
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      if (!privateKey) {
        // Try to read from file for local development
        try {
          const keyFile = require('fs').readFileSync('/root/.openclaw/.firebase/service-account.json', 'utf8');
          const serviceAccount = JSON.parse(keyFile);
          privateKey = serviceAccount.private_key;
        } catch (e) {
          // Fallback - hardcode for Vercel deployment
          privateKey = process.env.FIREBASE_PRIVATE_KEY_INLINE || '';
        }
      }
      
      // Ensure privateKey is never undefined
      if (!privateKey) {
        throw new Error('Firebase private key not found');
      }
      
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@mission-board-70cab.iam.gserviceaccount.com';
      
      const serviceAccount: admin.ServiceAccount = {
        projectId,
        clientEmail,
        // Handle escaped newlines in environment variable
        privateKey: privateKey?.replace(/\\n/g, '\n') || '',
      };
      
      if (!admin.apps.length) {
        adminApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } else {
        adminApp = admin.apps[0];
      }
      
      firestore = admin.firestore();
    } catch (e) {
      console.error('Firebase init error:', e);
      throw e;
    }
  }
  return firestore!;
}

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
  id: string;
  conversation_id: string;
  task_id?: string;
  description: string;
  owner: string;
  category: string;
  confidence: number;
  source_agent: string;
  status: string;
}

// ========== CLOSED LOOP SYSTEM (from @voxyz_ai) ==========

interface MissionProposal {
  id: string;
  agent_id: string;
  agent_name: string;
  title: string;
  description: string;
  proposed_steps: string[]; // JSON array of step descriptions
  status: 'pending' | 'accepted' | 'rejected';
  reason?: string;
  auto_approved: boolean;
  created_at: string;
  reviewed_at?: string;
}

interface Mission {
  id: string;
  proposal_id?: string;
  title: string;
  description: string;
  status: 'approved' | 'running' | 'succeeded' | 'failed';
  created_by: string;
  created_at: string;
  completed_at?: string;
  outcome?: string;
}

interface MissionStep {
  id: string;
  mission_id: string;
  kind: 'draft_tweet' | 'crawl' | 'analyze' | 'research' | 'post' | 'test' | 'build' | 'deploy' | 'other';
  description: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  result?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface AgentEvent {
  id: string;
  agent_id: string;
  agent_name: string;
  kind: 'proposal_created' | 'mission_approved' | 'step_completed' | 'milestone' | 'decision' | 'learning';
  title: string;
  summary: string;
  tags: string[];
  created_at: string;
}

// Agent affinity scores for collaboration
interface AgentAffinity {
  agent_a: string;
  agent_b: string;
  score: number; // -100 to 100
  interactions: number;
}

// Agent daily limits
interface AgentLimits {
  agent_id: string;
  daily_proposal_limit: number;
  proposals_today: number;
  last_reset: string;
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

// Initialize agents lazily
let agentsInitialized = false;
async function initAgents(db: FirebaseFirestore.Firestore) {
  if (agentsInitialized) return;
  try {
    const snapshot = await db.collection('agents').limit(1).get();
    if (snapshot.empty) {
      const batch = db.batch();
      for (const agent of defaultAgents) {
        batch.set(db.collection('agents').doc(agent.id), agent);
      }
      await batch.commit();
    }
    agentsInitialized = true;
  } catch (e) {
    console.log('Agents initialization deferred');
  }
}

// Tasks
export const tasksDb = {
  getAll: async (): Promise<Task[]> => {
    const db = getFirestore();
    await initAgents(db);
    const snapshot = await db.collection('tasks').orderBy('created_at', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
  },
  
  getById: async (id: string): Promise<Task | undefined> => {
    const db = getFirestore();
    await initAgents(db);
    const doc = await db.collection('tasks').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as Task : undefined;
  },
  
  addInteraction: async (interaction: Omit<Interaction, 'id'>): Promise<void> => {
    const db = getFirestore();
    await initAgents(db);
    try {
      const snapshot = await db.collection('interactions').where('task_id', '==', interaction.task_id).limit(1).get();
      const count = snapshot.size;
      const id = count + 1;
      await db.collection('interactions').add({ ...interaction, id: String(id) });
    } catch (e) {
      await db.collection('interactions').add({ ...interaction, id: '1' });
    }
  },
  
  create: async (task: Omit<Task, 'id'>): Promise<Task> => {
    const db = getFirestore();
    await initAgents(db);
    const docRef = await db.collection('tasks').add(task);
    
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
    const db = getFirestore();
    await initAgents(db);
    await db.collection('tasks').doc(id).update(updates);
    return tasksDb.getById(id);
  },
  
  getInteractions: async (taskId: string): Promise<Interaction[]> => {
    const db = getFirestore();
    await initAgents(db);
    const snapshot = await db.collection('interactions').where('task_id', '==', taskId).get();
    const interactions = snapshot.docs.map(doc => {
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
    // Sort by timestamp in memory
    return interactions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },
  
  delete: async (id: string): Promise<void> => {
    const db = getFirestore();
    await initAgents(db);
    await db.collection('tasks').doc(id).delete();
  },
  
  clear: async (): Promise<void> => {
    const db = getFirestore();
    await initAgents(db);
    const snapshot = await db.collection('tasks').get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  },
};

// Agents
export const agentsDb = {
  getAll: async (): Promise<Agent[]> => {
    const db = getFirestore();
    await initAgents(db);
    const snapshot = await db.collection('agents').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Agent));
  },
  
  getById: async (id: string): Promise<Agent | undefined> => {
    const db = getFirestore();
    await initAgents(db);
    const doc = await db.collection('agents').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as Agent : undefined;
  },
  
  update: async (id: string, updates: Partial<Agent>): Promise<Agent | undefined> => {
    const db = getFirestore();
    await initAgents(db);
    await db.collection('agents').doc(id).update(updates);
    return agentsDb.getById(id);
  },
};

// Conversations
export const conversationsDb = {
  getAll: async (): Promise<Conversation[]> => {
    const db = getFirestore();
    await initAgents(db);
    const snapshot = await db.collection('conversations').orderBy('updated_at', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
  },
  
  getById: async (id: string): Promise<Conversation | undefined> => {
    const db = getFirestore();
    await initAgents(db);
    const doc = await db.collection('conversations').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as Conversation : undefined;
  },
  
  create: async (conversation: Omit<Conversation, 'id' | 'status' | 'turns' | 'created_at' | 'updated_at'>): Promise<Conversation> => {
    const db = getFirestore();
    await initAgents(db);
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
    const db = getFirestore();
    await initAgents(db);
    const timestamp = new Date().toISOString();
    
    await db.collection('conversation_messages').add({
      ...message,
      timestamp,
    });
    
    await db.collection('conversations').doc(message.conversation_id).update({
      turns: message.turn,
      updated_at: timestamp,
    });
  },
  
  getMessages: async (conversationId: string): Promise<ConversationMessage[]> => {
    const db = getFirestore();
    await initAgents(db);
    // Get all messages for conversation (no orderBy to avoid index requirement)
    const snapshot = await db.collection('conversation_messages')
      .where('conversation_id', '==', conversationId)
      .get();
    // Sort by turn in memory
    const messages = snapshot.docs.map(doc => {
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
    return messages.sort((a, b) => a.turn - b.turn);
  },
  
  close: async (id: string): Promise<void> => {
    const db = getFirestore();
    await initAgents(db);
    await db.collection('conversations').doc(id).update({ status: 'closed' });
  },
  
  delete: async (id: string): Promise<void> => {
    const db = getFirestore();
    await initAgents(db);
    const msgSnapshot = await db.collection('conversation_messages').where('conversation_id', '==', id).get();
    const msgBatch = db.batch();
    msgSnapshot.docs.forEach(doc => msgBatch.delete(doc.ref));
    await msgBatch.commit();
    
    const actionSnapshot = await db.collection('extracted_actions').where('conversation_id', '==', id).get();
    const actionBatch = db.batch();
    actionSnapshot.docs.forEach(doc => actionBatch.delete(doc.ref));
    await actionBatch.commit();
    
    await db.collection('conversations').doc(id).delete();
  },
};

// Extracted Actions
export const extractedActionsDb = {
  getByConversation: async (conversationId: string): Promise<ExtractedAction[]> => {
    const db = getFirestore();
    await initAgents(db);
    const snapshot = await db.collection('extracted_actions')
      .where('conversation_id', '==', conversationId)
      .get();
    // Sort by id in memory
    const actions = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id, // Firestore doc ID is a string
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
    // Firestore returns in creation order, no need to sort by id
    return actions;
  },
  
  create: async (action: Omit<ExtractedAction, 'id' | 'status'>): Promise<ExtractedAction> => {
    const db = getFirestore();
    await initAgents(db);
    try {
      // Use the Firestore auto-generated ID as the id
      const docRef = await db.collection('extracted_actions').add({ ...action, status: 'pending' });
      return { id: docRef.id, status: 'pending', ...action };
    } catch (e) {
      console.error('Failed to create action:', e);
      throw e;
    }
  },
  
  updateTask: async (id: string, taskId: string): Promise<void> => {
    const db = getFirestore();
    await initAgents(db);
    // First try to find by Firestore doc ID
    const doc = await db.collection('extracted_actions').doc(id).get();
    if (doc.exists) {
      await doc.ref.update({ task_id: taskId, status: 'completed' });
    } else {
      // Fallback: try to find by id field (legacy)
      const snapshot = await db.collection('extracted_actions').where('id', '==', Number(id)).limit(1).get();
      if (!snapshot.empty) {
        await snapshot.docs[0].ref.update({ task_id: taskId, status: 'completed' });
      }
    }
  },
  
  getPending: async (): Promise<ExtractedAction[]> => {
    const db = getFirestore();
    await initAgents(db);
    const snapshot = await db.collection('extracted_actions').where('status', '==', 'pending').get();
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id, // Firestore doc ID is a string
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
    const db = getFirestore();
    await initAgents(db);
    // First try to find by Firestore doc ID
    const doc = await db.collection('extracted_actions').doc(id).get();
    if (doc.exists) {
      await doc.ref.update({ status: 'completed' });
    } else {
      // Fallback: try to find by id field (legacy)
      const snapshot = await db.collection('extracted_actions').where('id', '==', Number(id)).limit(1).get();
      if (!snapshot.empty) {
        await snapshot.docs[0].ref.update({ status: 'completed' });
      }
    }
  },
};

// ========== CLOSED LOOP SYSTEM (from @voxyz_ai) ==========

// Proposals
export const proposalsDb = {
  getAll: async (): Promise<MissionProposal[]> => {
    const db = getFirestore();
    await initAgents(db);
    const snapshot = await db.collection('proposals').orderBy('created_at', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MissionProposal));
  },
  
  getById: async (id: string): Promise<MissionProposal | undefined> => {
    const db = getFirestore();
    await initAgents(db);
    const doc = await db.collection('proposals').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as MissionProposal : undefined;
  },
  
  getPending: async (): Promise<MissionProposal[]> => {
    const db = getFirestore();
    await initAgents(db);
    const snapshot = await db.collection('proposals').where('status', '==', 'pending').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MissionProposal));
  },
  
  create: async (proposal: Omit<MissionProposal, 'id' | 'status' | 'auto_approved' | 'created_at'>): Promise<MissionProposal> => {
    const db = getFirestore();
    await initAgents(db);
    const now = new Date().toISOString();
    const docRef = await db.collection('proposals').add({
      ...proposal,
      status: 'pending',
      auto_approved: false,
      created_at: now,
    });
    
    // Fire event
    await eventsDb.create({
      agent_id: proposal.agent_id,
      agent_name: proposal.agent_name,
      kind: 'proposal_created',
      title: `New proposal: ${proposal.title}`,
      summary: proposal.description,
      tags: ['proposal', proposal.agent_id],
    });
    
    return { id: docRef.id, status: 'pending', auto_approved: false, created_at: now, ...proposal };
  },
  
  updateStatus: async (id: string, status: 'accepted' | 'rejected', reason?: string): Promise<MissionProposal | undefined> => {
    const db = getFirestore();
    await initAgents(db);
    await db.collection('proposals').doc(id).update({
      status,
      reason,
      reviewed_at: new Date().toISOString(),
    });
    return proposalsDb.getById(id);
  },
  
  autoApprove: async (id: string): Promise<MissionProposal | undefined> => {
    const db = getFirestore();
    await initAgents(db);
    await db.collection('proposals').doc(id).update({
      status: 'accepted',
      auto_approved: true,
      reviewed_at: new Date().toISOString(),
    });
    return proposalsDb.getById(id);
  },
  
  delete: async (id: string): Promise<void> => {
    const db = getFirestore();
    await initAgents(db);
    await db.collection('proposals').doc(id).delete();
  },
};

// Missions
export const missionsDb = {
  getAll: async (): Promise<Mission[]> => {
    const db = getFirestore();
    await initAgents(db);
    const snapshot = await db.collection('missions').orderBy('created_at', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mission));
  },
  
  getById: async (id: string): Promise<Mission | undefined> => {
    const db = getFirestore();
    await initAgents(db);
    const doc = await db.collection('missions').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as Mission : undefined;
  },
  
  create: async (mission: Omit<Mission, 'id' | 'status' | 'created_at'>): Promise<Mission> => {
    const db = getFirestore();
    await initAgents(db);
    const now = new Date().toISOString();
    const docRef = await db.collection('missions').add({
      ...mission,
      status: 'approved',
      created_at: now,
    });
    
    // Fire event
    await eventsDb.create({
      agent_id: mission.created_by,
      agent_name: mission.created_by,
      kind: 'mission_approved',
      title: `Mission approved: ${mission.title}`,
      summary: mission.description,
      tags: ['mission', 'approved'],
    });
    
    return { id: docRef.id, status: 'approved', created_at: now, ...mission };
  },
  
  updateStatus: async (id: string, status: 'running' | 'succeeded' | 'failed', outcome?: string): Promise<Mission | undefined> => {
    const db = getFirestore();
    await initAgents(db);
    const updates: any = { status };
    if (outcome) updates.outcome = outcome;
    if (status === 'succeeded' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }
    await db.collection('missions').doc(id).update(updates);
    return missionsDb.getById(id);
  },
  
  delete: async (id: string): Promise<void> => {
    const db = getFirestore();
    await initAgents(db);
    await db.collection('missions').doc(id).delete();
  },
};

// Mission Steps
export const stepsDb = {
  getByMission: async (missionId: string): Promise<MissionStep[]> => {
    const db = getFirestore();
    await initAgents(db);
    const snapshot = await db.collection('steps').where('mission_id', '==', missionId).get();
    const steps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MissionStep));
    // Sort by created_at in memory
    return steps.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },
  
  getById: async (id: string): Promise<MissionStep | undefined> => {
    const db = getFirestore();
    await initAgents(db);
    const doc = await db.collection('steps').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as MissionStep : undefined;
  },
  
  getQueued: async (): Promise<MissionStep[]> => {
    const db = getFirestore();
    await initAgents(db);
    const snapshot = await db.collection('steps').where('status', '==', 'queued').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MissionStep));
  },
  
  create: async (step: Omit<MissionStep, 'id' | 'status' | 'created_at'>): Promise<MissionStep> => {
    const db = getFirestore();
    await initAgents(db);
    const now = new Date().toISOString();
    const docRef = await db.collection('steps').add({
      ...step,
      status: 'queued',
      created_at: now,
    });
    return { id: docRef.id, status: 'queued', created_at: now, ...step };
  },
  
  updateStatus: async (id: string, status: 'running' | 'succeeded' | 'failed', result?: string): Promise<MissionStep | undefined> => {
    const db = getFirestore();
    await initAgents(db);
    const updates: any = { status };
    if (result) updates.result = result;
    if (status === 'running') updates.started_at = new Date().toISOString();
    if (status === 'succeeded' || status === 'failed') updates.completed_at = new Date().toISOString();
    await db.collection('steps').doc(id).update(updates);
    return stepsDb.getById(id);
  },
  
  delete: async (id: string): Promise<void> => {
    const db = getFirestore();
    await initAgents(db);
    await db.collection('steps').doc(id).delete();
  },
};

// Agent Events (the learning/memory system)
export const eventsDb = {
  getRecent: async (limit: number = 50): Promise<AgentEvent[]> => {
    const db = getFirestore();
    await initAgents(db);
    const snapshot = await db.collection('events').orderBy('created_at', 'desc').limit(limit).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AgentEvent));
  },
  
  getByAgent: async (agentId: string): Promise<AgentEvent[]> => {
    const db = getFirestore();
    await initAgents(db);
    const snapshot = await db.collection('events').where('agent_id', '==', agentId).orderBy('created_at', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AgentEvent));
  },
  
  getByTag: async (tag: string): Promise<AgentEvent[]> => {
    const db = getFirestore();
    await initAgents(db);
    const snapshot = await db.collection('events').where('tags', 'array-contains', tag).orderBy('created_at', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AgentEvent));
  },
  
  create: async (event: Omit<AgentEvent, 'id' | 'created_at'>): Promise<AgentEvent> => {
    const db = getFirestore();
    await initAgents(db);
    const docRef = await db.collection('events').add({
      ...event,
      created_at: new Date().toISOString(),
    });
    return { id: docRef.id, created_at: new Date().toISOString(), ...event };
  },
  
  getLearnings: async (agentId: string, days: number = 7): Promise<AgentEvent[]> => {
    const db = getFirestore();
    await initAgents(db);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const snapshot = await db.collection('events')
      .where('agent_id', '==', agentId)
      .where('created_at', '>=', cutoff)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AgentEvent));
  },
};

// Agent Affinity (collaboration scores)
export const affinityDb = {
  getScore: async (agentA: string, agentB: string): Promise<number> => {
    const db = getFirestore();
    await initAgents(db);
    const id = [agentA, agentB].sort().join('_');
    const doc = await db.collection('affinity').doc(id).get();
    return doc.exists ? doc.data()?.score || 0 : 0;
  },
  
  updateScore: async (agentA: string, agentB: string, delta: number): Promise<void> => {
    const db = getFirestore();
    await initAgents(db);
    const id = [agentA, agentB].sort().join('_');
    const doc = await db.collection('affinity').doc(id).get();
    const current = doc.exists ? doc.data()?.score || 0 : 0;
    const interactions = doc.exists ? (doc.data()?.interactions || 0) + 1 : 1;
    const newScore = Math.max(-100, Math.min(100, current + delta));
    await db.collection('affinity').doc(id).set({
      agent_a: [agentA, agentB][0],
      agent_b: [agentA, agentB][1],
      score: newScore,
      interactions,
      updated_at: new Date().toISOString(),
    });
  },
};

// Agent Daily Limits
export const limitsDb = {
  get: async (agentId: string): Promise<AgentLimits> => {
    const db = getFirestore();
    await initAgents(db);
    const doc = await db.collection('limits').doc(agentId).get();
    if (!doc.exists) {
      return { agent_id: agentId, daily_proposal_limit: 10, proposals_today: 0, last_reset: new Date().toISOString() };
    }
    return { agent_id: agentId, ...doc.data() } as AgentLimits;
  },
  
  checkAndIncrement: async (agentId: string): Promise<{ allowed: boolean; remaining: number }> => {
    const db = getFirestore();
    await initAgents(db);
    const doc = await db.collection('limits').doc(agentId).get();
    let limit = doc.exists ? doc.data()?.daily_proposal_limit || 10 : 10;
    let used = doc.exists ? doc.data()?.proposals_today || 0 : 0;
    const lastReset = doc.exists ? doc.data()?.last_reset : null;
    
    // Reset if new day
    if (lastReset) {
      const resetDate = new Date(lastReset).toDateString();
      const today = new Date().toDateString();
      if (resetDate !== today) {
        used = 0;
        await db.collection('limits').doc(agentId).update({
          proposals_today: 0,
          last_reset: new Date().toISOString(),
        });
      }
    }
    
    if (used >= limit) {
      return { allowed: false, remaining: 0 };
    }
    
    await db.collection('limits').doc(agentId).set({
      agent_id: agentId,
      daily_proposal_limit: limit,
      proposals_today: used + 1,
      last_reset: new Date().toISOString(),
    }, { merge: true });
    
    return { allowed: true, remaining: limit - used - 1 };
  },
};

export default {
  tasksDb,
  agentsDb,
  conversationsDb,
  extractedActionsDb,
  proposalsDb,
  missionsDb,
  stepsDb,
  eventsDb,
  affinityDb,
  limitsDb,
};

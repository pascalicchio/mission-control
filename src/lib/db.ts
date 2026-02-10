import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'missions.db');
const db = new Database(dbPath);

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'normal',
    agent TEXT,
    result TEXT,
    created_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    duration INTEGER
  );

  CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT,
    agent TEXT,
    action TEXT,
    message TEXT,
    timestamp TEXT,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  );

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT,
    status TEXT DEFAULT 'idle',
    current_task TEXT,
    last_active TEXT,
    mood TEXT DEFAULT 'neutral',
    task_count INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 100
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    topic TEXT,
    status TEXT DEFAULT 'active',
    turns INTEGER DEFAULT 0,
    participants TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS conversation_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT,
    turn INTEGER,
    agent_id TEXT,
    agent_name TEXT,
    agent_emoji TEXT,
    message TEXT,
    timestamp TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  );

  CREATE TABLE IF NOT EXISTS extracted_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT,
    task_id TEXT,
    description TEXT,
    owner TEXT,
    category TEXT,
    confidence REAL,
    source_agent TEXT,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  );
`);

// Seed agents if not exists
const agentCount = db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
if (agentCount.count === 0) {
  const insertAgent = db.prepare(`
    INSERT INTO agents (id, name, emoji, status, last_active, mood, task_count, success_rate) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const agents = [
    ['loki', 'Loki', '🦇', 'idle', new Date().toISOString(), 'happy', 12, 92],
    ['wanda', 'Wanda', '🩸', 'idle', new Date().toISOString(), 'neutral', 8, 88],
    ['pulse', 'Pulse', '💜', 'idle', new Date().toISOString(), 'stressed', 15, 95],
    ['vision', 'Vision', '💎', 'idle', new Date().toISOString(), 'happy', 6, 100],
    ['friday', 'Friday', '🤖', 'idle', new Date().toISOString(), 'neutral', 20, 85],
    ['jocasta', 'Jocasta', '👩‍💻', 'idle', new Date().toISOString(), 'happy', 10, 90],
    ['fury', 'Fury', '👁️', 'idle', new Date().toISOString(), 'neutral', 5, 80],
    ['maria', 'Maria', '👩‍✈️', 'idle', new Date().toISOString(), 'happy', 9, 89],
    ['phil', 'Phil', '🕷️', 'idle', new Date().toISOString(), 'happy', 14, 93],
    ['miles', 'Miles', '🕸️', 'idle', new Date().toISOString(), 'neutral', 7, 86],
  ];

  for (const agent of agents) {
    insertAgent.run(...agent);
  }
}

// Task operations
export const tasksDb = {
  getAll: () => db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all(),
  
  getById: (id: string) => db.prepare('SELECT * FROM tasks WHERE id = ?').get(id),
  
  addInteraction: (interaction: {
    task_id: string;
    agent: string;
    action: string;
    message: string;
    timestamp: string;
  }) => {
    db.prepare(`
      INSERT INTO interactions (task_id, agent, action, message, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(interaction.task_id, interaction.agent, interaction.action, interaction.message, interaction.timestamp);
  },
  
  create: (task: {
    id: string;
    title: string;
    status: string;
    priority: string;
    created_at: string;
  }) => {
    db.prepare(`
      INSERT INTO tasks (id, title, status, priority, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(task.id, task.title, task.status, task.priority, task.created_at);
    
    // Add creation interaction
    tasksDb.addInteraction({
      task_id: task.id,
      agent: 'System',
      action: 'created',
      message: `Task "${task.title}" created with ${task.priority} priority`,
      timestamp: task.created_at,
    });
    
    return task;
  },
  
  update: (id: string, updates: Record<string, any>) => {
    const fields = Object.keys(updates).filter(k => k !== 'id');
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => updates[f]).concat(id);
    
    db.prepare(`UPDATE tasks SET ${setClause} WHERE id = ?`).run(...values);
    return tasksDb.getById(id);
  },
  
  getInteractions: (taskId: string) => db.prepare('SELECT * FROM interactions WHERE task_id = ? ORDER BY timestamp ASC').all(taskId),
  
  delete: (id: string) => {
    db.prepare('DELETE FROM interactions WHERE task_id = ?').run(id);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  },
  
  clear: () => {
    db.prepare('DELETE FROM interactions').run();
    db.prepare('DELETE FROM tasks').run();
  },
};

// Agent operations
export const agentsDb = {
  getAll: () => db.prepare('SELECT * FROM agents ORDER BY name ASC').all(),
  
  getById: (id: string) => db.prepare('SELECT * FROM agents WHERE id = ?').get(id),
  
  update: (id: string, updates: Record<string, any>) => {
    const fields = Object.keys(updates).filter(k => k !== 'id');
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => updates[f]).concat(id);
    
    db.prepare(`UPDATE agents SET ${setClause} WHERE id = ?`).run(...values);
    return agentsDb.getById(id);
  },
};

// Conversation operations
export const conversationsDb = {
  getAll: () => db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all(),
  
  getById: (id: string) => db.prepare('SELECT * FROM conversations WHERE id = ?').get(id),
  
  create: (conversation: {
    id: string;
    title: string;
    topic: string;
    participants: string;
  }) => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO conversations (id, title, topic, participants, status, turns, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', 0, ?, ?)
    `).run(conversation.id, conversation.title, conversation.topic, conversation.participants, now, now);
    return conversationsDb.getById(conversation.id);
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
    db.prepare(`
      INSERT INTO conversation_messages (conversation_id, turn, agent_id, agent_name, agent_emoji, message, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(message.conversation_id, message.turn, message.agent_id, message.agent_name, message.agent_emoji, message.message, timestamp);
    
    // Update conversation turn count and timestamp
    db.prepare(`UPDATE conversations SET turns = ?, updated_at = ? WHERE id = ?`).run(message.turn, timestamp, message.conversation_id);
  },
  
  getMessages: (conversationId: string) => db.prepare('SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY turn ASC').all(conversationId),
  
  close: (id: string) => {
    db.prepare(`UPDATE conversations SET status = 'closed' WHERE id = ?`).run(id);
  },
  
  delete: (id: string) => {
    db.prepare('DELETE FROM extracted_actions WHERE conversation_id = ?').run(id);
    db.prepare('DELETE FROM conversation_messages WHERE conversation_id = ?').run(id);
    db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  },
};

// Extracted actions from conversations
export const extractedActionsDb = {
  getByConversation: (conversationId: string) => 
    db.prepare('SELECT * FROM extracted_actions WHERE conversation_id = ? ORDER BY id ASC').all(conversationId),
  
  create: (action: {
    conversation_id: string;
    task_id?: string;
    description: string;
    owner: string;
    category: string;
    confidence: number;
    source_agent: string;
  }) => {
    db.prepare(`
      INSERT INTO extracted_actions (conversation_id, task_id, description, owner, category, confidence, source_agent, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(action.conversation_id, action.task_id, action.description, action.owner, action.category, action.confidence, action.source_agent);
    return db.prepare('SELECT * FROM extracted_actions WHERE id = ?').get(db.prepare('SELECT last_insert_rowid() as id').get() as any);
  },
  
  updateTask: (id: string, taskId: string) => {
    db.prepare(`UPDATE extracted_actions SET task_id = ? WHERE id = ?`).run(taskId, id);
  },
  
  getPending: () => db.prepare('SELECT * FROM extracted_actions WHERE status = "pending"').all(),
  
  complete: (id: string) => {
    db.prepare(`UPDATE extracted_actions SET status = 'completed' WHERE id = ?`).run(id);
  },
};

export default db;

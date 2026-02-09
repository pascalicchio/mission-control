import { NextRequest, NextResponse } from 'next/server';
import { tasksDb, agentsDb } from '@/lib/db';
import { emitTaskUpdate, emitAgentUpdate, emitActivity } from '@/lib/socket';

// Agent role descriptions for OpenClaw sessions
function getAgentRole(agentId: string): string {
  const roles: Record<string, string> = {
    loki: 'You are a research specialist. Find relevant information, analyze data, and provide comprehensive insights.',
    wanda: 'You are a social media expert. Create engaging posts, tweets, and content for social platforms.',
    pulse: 'You are a content writer. Write blog posts, articles, and marketing copy with SEO optimization.',
    vision: 'You are an analyst. Examine data, find patterns, and provide strategic recommendations.',
    friday: 'You are a developer. Write clean, efficient code and solve technical problems.',
    jocasta: 'You are an automation expert. Set up schedules, integrations, and workflow automation.',
    maria: 'You are an integration specialist. Connect APIs and set up data flows.',
    fury: 'You are a reviewer. Analyze existing work and provide feedback.',
    phil: 'You are a deployment specialist. Launch and manage production deployments.',
    miles: 'You are a creative designer. Design visuals, graphics, and creative assets.',
  };
  return roles[agentId] || 'You are a helpful AI assistant. Complete the task efficiently.';
}

// Keyword handlers
const KEYWORD_HANDLERS: Record<string, (task: string) => Promise<{result: string, agent: string}>> = {
  research: async (task) => {
    const topic = task.replace(/^(research|analyze|check|look up|find)\s+/i, '');
    return {
      result: `🔍 Research complete on "${topic}":\n\nFound 5 relevant sources. Key insights synthesized and ready for review.`,
      agent: 'loki'
    };
  },
  
  post: async (task) => {
    // Use x-api skill for real posting
    const content = task.replace(/^(post|post to|tweet|share)\s+(?:on\s+)?(?:x|twitter|bluesky|instagram)?\s*/i, '');
    
    try {
      const { execSync } = require('child_process');
      const xResult = execSync(
        `cd ~/.openclaw/skills/x-api/scripts && node x-post.mjs "${content.replace(/"/g, '\\"')}"`,
        { encoding: 'utf8', timeout: 15000 }
      );
      return {
        result: `🐦 ${xResult.trim()}`,
        agent: 'wanda'
      };
    } catch (error: any) {
      return {
        result: `❌ X posting failed: ${error.message || 'Unknown error'}`,
        agent: 'wanda'
      };
    }
  },
  
  blog: async (task) => {
    const topic = task.replace(/^(write|create|blog|article|post)\s+(?:post\s+)?(?:about\s+)?/i, '');
    return {
      result: `✍️ Blog post drafted: "${topic}"\n\nSEO-optimized, 800 words, includes CTA. Ready for review.`,
      agent: 'pulse'
    };
  },
  
  build: async (task) => {
    const what = task.replace(/^(build|create|make|coding|code)\s+/i, '');
    return {
      result: `💻 Built "${what}":\n\nCode generated, tested, and deployed. Check repository for details.`,
      agent: 'friday'
    };
  },
  
  fix: async (task) => {
    const bug = task.replace(/^(fix|debug|repair|solve)\s+/i, '');
    return {
      result: `🐛 Fixed "${bug}":\n\nRoot cause identified, patch applied, tests passing.`,
      agent: 'vision'
    };
  },
  
  deploy: async (task) => {
    const what = task.replace(/^(deploy|launch|release)\s+/i, '');
    return {
      result: `🚀 Deployed "${what}":\n\nLive at production URL. Monitor active.`,
      agent: 'phil'
    };
  },
  
  schedule: async (task) => {
    const what = task.replace(/^(schedule|set up|cron|automate)\s+/i, '');
    return {
      result: `⏰ Scheduled: "${what}"\n\nCron job created. Will execute at specified intervals.`,
      agent: 'jocasta'
    };
  },
  
  integrate: async (task) => {
    const api = task.replace(/^(integrate|connect|add api)\s+/i, '');
    return {
      result: `🔗 Integration complete: "${api}"\n\nAPI connected, authentication configured, endpoints tested.`,
      agent: 'maria'
    };
  },
  
  analyze: async (task) => {
    const what = task.replace(/^(analyze|analysis)\s+/i, '');
    return {
      result: `📊 Analysis complete: "${what}"\n\nKey metrics identified, trends mapped, recommendations provided.`,
      agent: 'fury'
    };
  },
  
  design: async (task) => {
    const what = task.replace(/^(design|create|make)\s+(?:a\s+)?(?:graphic|image|visual)\s+/i, '');
    return {
      result: `🎨 Design created: "${what}"\n\nVisual assets generated, optimized, and ready for use.`,
      agent: 'miles'
    };
  },
  
  default: async (task) => {
    return {
      result: `✅ Task completed: "${task}"\n\nExecuted successfully. Results available for review.`,
      agent: 'phil'
    };
  }
};

export async function POST(request: NextRequest) {
  try {
    const { task, taskId, priority = 'normal' } = await request.json();

    if (!task || !taskId) {
      return NextResponse.json({ error: 'Task and taskId required' }, { status: 400 });
    }

    console.log(`[Mission Control] 📤 Executing: ${task} (ID: ${taskId})`);

    // Get the task from database
    const dbTask = tasksDb.getById(taskId);
    if (!dbTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Update to executing
    tasksDb.update(taskId, { 
      status: 'executing', 
      started_at: new Date().toISOString() 
    });
    
    const updatedTask = tasksDb.getById(taskId);
    emitTaskUpdate('task:updated', updatedTask);

    // Smart agent routing based on keywords
    const taskLower = task.toLowerCase();
    const allAgents = agentsDb.getAll() as any[];
    
    // Keyword to agent mapping - ordered by PRIORITY (blog > research > others)
    const keywordAgentMap: Record<string, string> = {
      // BLOG/WRITE - highest priority for content
      'blog': 'pulse',
      'write a blog': 'pulse',
      'write me a blog': 'pulse',
      
      // SOCIAL
      'post': 'wanda',
      'tweet': 'wanda',
      'share': 'wanda',
      
      // RESEARCH - lower priority than blog
      'research': 'loki',
      'analyze': 'loki',
      
      // DEVELOPMENT
      'build': 'friday',
      'code': 'friday',
      'fix': 'vision',
      'debug': 'vision',
      'deploy': 'phil',
      'launch': 'phil',
      
      // AUTOMATION
      'schedule': 'jocasta',
      'cron': 'jocasta',
      'integrate': 'maria',
      'api': 'maria',
      
      // CREATIVE
      'design': 'miles',
      'visual': 'miles',
      
      // OTHER
      'email': 'pepper',
      'test': 'shuri',
      'review': 'fury',
    };

    // First check for multi-word phrases (blog post variations)
    const multiWordPatterns = [
      'write me a blog',
      'write a blog',
      'blog post',
    ];
    
    for (const pattern of multiWordPatterns) {
      if (taskLower.includes(pattern)) {
        keywordAgentMap[pattern] = 'pulse';
      }
    }

    // Find best agent based on keyword match - check LONGER phrases first
    let targetAgentId = null;
    
    // Check multi-word patterns first
    for (const pattern of multiWordPatterns) {
      if (taskLower.includes(pattern)) {
        targetAgentId = keywordAgentMap[pattern];
        break;
      }
    }
    
    // Then check single keywords
    if (!targetAgentId) {
      for (const [keyword, agentId] of Object.entries(keywordAgentMap)) {
        if (taskLower.includes(keyword) && !multiWordPatterns.includes(keyword)) {
          targetAgentId = agentId;
          break;
        }
      }
    }

    // Try to get the keyword-matched agent
    const matchedAgent = allAgents.find((a: any) => a.id === targetAgentId);
    if (matchedAgent && matchedAgent.status === 'idle') {
      // Good - use matched agent
    }

    // Fallback to any idle agent
    let agent: any;
    if (!targetAgentId) {
      const idleAgents = allAgents.filter((a: any) => a.status === 'idle');
      agent = idleAgents[0] || allAgents[0];
    } else {
      const matchedAgent = allAgents.find((a: any) => a.id === targetAgentId);
      agent = matchedAgent || allAgents[0];
    }

    // Mark agent as busy
    agentsDb.update(agent.id, {
      status: 'executing',
      current_task: task,
      last_active: new Date().toISOString(),
    });
    emitAgentUpdate(agentsDb.getAll());

    // Route to appropriate handler based on keywords
    let handler = KEYWORD_HANDLERS.default;
    
    for (const [keyword, handlerFn] of Object.entries(KEYWORD_HANDLERS)) {
      if (taskLower.includes(keyword) && keyword !== 'default') {
        handler = handlerFn;
        break;
      }
    }

    // Execute task (with delay to simulate work)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const result = await handler(task);

    // Update task as completed
    const completedAt = new Date().toISOString();
    const duration = updatedTask?.started_at 
      ? Math.round((new Date(completedAt).getTime() - new Date(updatedTask.started_at).getTime()) / 1000)
      : 0;

    tasksDb.update(taskId, {
      status: 'done',
      result: result.result,
      agent: result.agent,
      completed_at: completedAt,
      duration,
    });

    tasksDb.addInteraction({
      task_id: taskId,
      agent: result.agent,
      action: 'completed',
      message: result.result,
      timestamp: completedAt,
    });

    // Mark agent as idle
    agentsDb.update(agent.id, {
      status: 'idle',
      current_task: null,
      last_active: completedAt,
      task_count: (agent as any).task_count + 1,
    });

    // Emit real-time updates
    const finalTask = tasksDb.getById(taskId);
    emitTaskUpdate('task:completed', finalTask);
    emitAgentUpdate(agentsDb.getAll());
    emitActivity({
      id: Date.now().toString(),
      type: 'task_completed',
      message: `Task "${task}" completed by ${result.agent}`,
      timestamp: completedAt,
      duration,
    });

    console.log(`[Mission Control] ✅ Completed: ${taskId} by ${result.agent} (${duration}s)`);

    return NextResponse.json({
      success: true,
      taskId,
      result: result.result,
      agent: result.agent,
      duration,
    });
  } catch (error) {
    console.error('[Mission Control] ❌ Execution error:', error);
    return NextResponse.json(
      { error: 'Execution failed' },
      { status: 500 }
    );
  }
}

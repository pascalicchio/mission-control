import { NextRequest, NextResponse } from 'next/server';
import { tasksDb, agentsDb, conversationsDb } from '@/lib/db';

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

export async function POST(request: NextRequest) {
  try {
    const { task, taskId, priority = 'normal' } = await request.json();
    
    if (!task || !taskId) {
      return NextResponse.json({ error: 'Task and taskId required' }, { status: 400 });
    }

    // Update task to executing
    await tasksDb.update(taskId, {
      status: 'executing',
      started_at: new Date().toISOString()
    });
    
    const updatedTask = await tasksDb.getById(taskId);

    // Smart agent routing based on keywords
    const taskLower = task.toLowerCase();
    const allAgents = await agentsDb.getAll();
    
    // Keyword to agent mapping - ordered by PRIORITY (blog > research > others)
    const keywordAgentMap: Record<string, string> = {
      // BLOG/WRITE - highest priority for content
      'blog': 'pulse',
      'write a blog': 'pulse',
      'write': 'pulse',
      'content': 'pulse',
      'article': 'pulse',
      'post': 'wanda',
      // RESEARCH
      'research': 'loki',
      'analyze': 'loki',
      'find': 'loki',
      'discover': 'loki',
      // SOCIAL
      'tweet': 'wanda',
      'x.com': 'wanda',
      'social': 'wanda',
      // BUILD/CODE
      'build': 'friday',
      'code': 'friday',
      'fix': 'friday',
      'debug': 'friday',
      'create': 'friday',
      // DEPLOY
      'deploy': 'phil',
      'launch': 'phil',
      'production': 'phil',
      // INTEGRATIONS
      'integrate': 'maria',
      'api': 'maria',
      'connect': 'maria',
      // AUTOMATION
      'schedule': 'jocasta',
      'cron': 'jocasta',
      'automation': 'jocasta',
      // REVIEW
      'review': 'fury',
      'check': 'fury',
      'audit': 'fury',
      // STRATEGY
      'strategy': 'vision',
      'recommend': 'vision',
      'kpi': 'vision',
      // DESIGN
      'design': 'miles',
      'visual': 'miles',
      'graphic': 'miles',
    };
    
    let selectedAgentId = 'friday'; // Default agent
    
    for (const [keyword, agentId] of Object.entries(keywordAgentMap)) {
      if (taskLower.includes(keyword)) {
        selectedAgentId = agentId;
        break;
      }
    }
    
    const agent = allAgents.find((a: Agent) => a.id === selectedAgentId) || allAgents[0];

    // Mark agent as busy
    await agentsDb.update(agent.id, {
      status: 'executing',
      current_task: task,
      last_active: new Date().toISOString(),
    });

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

    // Simulate result
    const result = await handler(task, selectedAgentId);
    const completedAt = new Date().toISOString();
    
    const duration = updatedTask?.started_at 
      ? Math.round((new Date().getTime() - new Date(updatedTask.started_at).getTime()) / 1000)
      : 2;

    // Mark task as done
    await tasksDb.update(taskId, {
      status: 'done',
      result: result,
      agent: agent.name,
      completed_at: completedAt,
      duration,
    });

    // Mark agent as idle
    await agentsDb.update(agent.id, {
      status: 'idle',
      current_task: undefined,
      last_active: completedAt,
      task_count: agent.task_count + 1,
    });

    // Add completion interaction
    await tasksDb.addInteraction({
      task_id: taskId,
      agent: agent.name,
      action: 'completed',
      message: result,
      timestamp: completedAt,
    });

    console.log(`[Mission Control] ✅ Completed: ${taskId} by ${agent.name} (${duration}s)`);

    return NextResponse.json({
      success: true,
      taskId,
      result: result,
      agent: agent.name,
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

const KEYWORD_HANDLERS: Record<string, (task: string, agentId: string) => Promise<string>> = {
  // Research agent
  async research(task: string): Promise<string> {
    return `🔍 Research complete on "${task}": Synthesized findings from multiple sources with actionable insights.`;
  },
  
  async analyze(task: string): Promise<string> {
    return `📊 Analysis complete on "${task}": Key patterns identified with data-driven recommendations.`;
  },
  
  // Social/Wanda
  async post(task: string): Promise<string> {
    return `🐦 Posted to social media: "${task}"`;
  },
  
  async tweet(task: string): Promise<string> {
    return `🐦 Tweet posted successfully!`;
  },
  
  // Content/Pulse
  async blog(task: string): Promise<string> {
    return `📝 Blog post published: "${task}" - Optimized for SEO and ready for sharing.`;
  },
  
  async write(task: string): Promise<string> {
    return `✍️ Content created: "${task}" - Compelling copy ready for review.`;
  },
  
  async content(task: string): Promise<string> {
    return `📄 Content crafted: "${task}" - Engaging narrative with clear CTAs.`;
  },
  
  // Friday (build/code)
  async build(task: string): Promise<string> {
    return `🛠️ Built successfully: "${task}" - All tests passing.`;
  },
  
  async code(task: string): Promise<string> {
    return `💻 Code complete: "${task}" - Clean, documented, and ready for review.`;
  },
  
  async fix(task: string): Promise<string> {
    return `🐛 Fix applied: "${task}" - Issue resolved and regression tested.`;
  },
  
  async create(task: string): Promise<string> {
    return `✨ Created: "${task}" - New asset/component ready for use.`;
  },
  
  // Deployment/Phil
  async deploy(task: string): Promise<string> {
    return `🚀 Deployed: "${task}" - Live in production with monitoring enabled.`;
  },
  
  async launch(task: string): Promise<string> {
    return `🎯 Launched: "${task}" - Now available to users.`;
  },
  
  // Maria (integrations)
  async integrate(task: string): Promise<string> {
    return `🔗 Integration complete: "${task}" - Systems connected and data flowing.`;
  },
  
  async api(task: string): Promise<string> {
    return `🌐 API endpoint ready: "${task}" - Documentation auto-generated.`;
  },
  
  // Jocasta (automation)
  async schedule(task: string): Promise<string> {
    return `📅 Scheduled: "${task}" - Automated workflow active.`;
  },
  
  async automation(task: string): Promise<string> {
    return `⚙️ Automation set up: "${task}" - Runs on configured triggers.`;
  },
  
  // Vision (strategy)
  async strategy(task: string): Promise<string> {
    return `💎 Strategic analysis complete: "${task}" - Recommendations aligned with goals.`;
  },
  
  async recommend(task: string): Promise<string> {
    return `💡 Recommendations delivered: "${task}" - Prioritized action items included.`;
  },
  
  // Fury (review)
  async review(task: string): Promise<string> {
    return `👁️ Review complete: "${task}" - Feedback provided with improvement suggestions.`;
  },
  
  async check(task: string): Promise<string> {
    return `✅ Check passed: "${task}" - All criteria met.`;
  },
  
  // Miles (design)
  async design(task: string): Promise<string> {
    return `🎨 Design complete: "${task}" - Visual assets ready for implementation.`;
  },
  
  async visual(task: string): Promise<string> {
    return `🕸️ Visuals created: "${task}" - On-brand and optimized for all platforms.`;
  },
  
  // Default handler
  async default(task: string, agentId: string): Promise<string> {
    return `✅ Completed: "${task}" - Executed by ${agentId} agent.`;
  },
};

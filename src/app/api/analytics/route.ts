import { NextRequest, NextResponse } from 'next/server';
import { tasksDb, agentsDb } from '@/lib/db';

export async function GET() {
  try {
    const tasks = tasksDb.getAll() as any[];
    const agents = agentsDb.getAll() as any[];

    // Calculate metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const failedTasks = tasks.filter(t => t.status === 'failed').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'executing').length;

    // Calculate success rate
    const completedWithResult = tasks.filter(t => t.status === 'done' && t.result);
    const successRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;

    // Average duration
    const tasksWithDuration = tasks.filter(t => t.duration);
    const avgDuration = tasksWithDuration.length > 0
      ? Math.round(tasksWithDuration.reduce((a: number, b: any) => a + (b.duration || 0), 0) / tasksWithDuration.length)
      : 0;

    // Tasks by agent
    const tasksByAgent: Record<string, { total: number; completed: number; failed: number }> = {};
    agents.forEach(agent => {
      tasksByAgent[agent.id] = { total: 0, completed: 0, failed: 0 };
    });
    tasks.forEach(task => {
      if (task.agent && tasksByAgent[task.agent]) {
        tasksByAgent[task.agent].total++;
        if (task.status === 'done') tasksByAgent[task.agent].completed++;
        if (task.status === 'failed') tasksByAgent[task.agent].failed++;
      }
    });

    // Recent activity (last 10 tasks)
    const recentTasks = tasks.slice(0, 10).map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      agent: t.agent,
      duration: t.duration,
      completed_at: t.completed_at,
    }));

    // Task type breakdown
    const taskTypes: Record<string, number> = {};
    tasks.forEach(task => {
      const type = getTaskType(task.title);
      taskTypes[type] = (taskTypes[type] || 0) + 1;
    });

    return NextResponse.json({
      metrics: {
        totalTasks,
        completedTasks,
        failedTasks,
        pendingTasks,
        successRate,
        avgDuration,
      },
      tasksByAgent,
      recentTasks,
      taskTypes,
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        emoji: a.emoji,
        taskCount: a.task_count,
        successRate: a.success_rate,
        status: a.status,
      })),
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to generate analytics' }, { status: 500 });
  }
}

function getTaskType(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('research') || lower.includes('analyze')) return 'Research';
  if (lower.includes('blog') || lower.includes('write') || lower.includes('post')) return 'Content';
  if (lower.includes('build') || lower.includes('code') || lower.includes('fix')) return 'Development';
  if (lower.includes('deploy') || lower.includes('launch')) return 'Deployment';
  if (lower.includes('schedule') || lower.includes('integrate')) return 'Automation';
  return 'General';
}

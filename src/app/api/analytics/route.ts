import { NextResponse } from 'next/server';
import { tasksDb, agentsDb } from '@/lib/db';

export async function GET() {
  try {
    const [tasks, agents] = await Promise.all([tasksDb.getAll(), agentsDb.getAll()]);
    
    // Calculate metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const failedTasks = tasks.filter(t => t.status === 'failed').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const executingTasks = tasks.filter(t => t.status === 'executing').length;
    
    const avgDuration = tasks.filter(t => t.duration).length > 0
      ? Math.round(tasks.filter(t => t.duration).reduce((sum, t) => sum + (t.duration || 0), 0) / tasks.filter(t => t.duration).length)
      : 0;
    
    const totalAgents = agents.length;
    const idleAgents = agents.filter(a => a.status === 'idle').length;
    const executingAgents = agents.filter(a => a.status === 'executing').length;
    
    const avgSuccessRate = agents.length > 0
      ? Math.round(agents.reduce((sum, a) => sum + a.success_rate, 0) / agents.length)
      : 0;
    
    const totalTasksCompleted = agents.reduce((sum, a) => sum + a.task_count, 0);
    
    const taskTypeBreakdown = {
      research: tasks.filter(t => t.title.toLowerCase().includes('research') || t.title.toLowerCase().includes('analyze')).length,
      content: tasks.filter(t => t.title.toLowerCase().includes('blog') || t.title.toLowerCase().includes('write') || t.title.toLowerCase().includes('content')).length,
      social: tasks.filter(t => t.title.toLowerCase().includes('post') || t.title.toLowerCase().includes('tweet') || t.title.toLowerCase().includes('social')).length,
      build: tasks.filter(t => t.title.toLowerCase().includes('build') || t.title.toLowerCase().includes('code') || t.title.toLowerCase().includes('fix') || t.title.toLowerCase().includes('create')).length,
      deploy: tasks.filter(t => t.title.toLowerCase().includes('deploy') || t.title.toLowerCase().includes('launch') || t.title.toLowerCase().includes('production')).length,
      other: tasks.length - 
        tasks.filter(t => t.title.toLowerCase().includes('research') || t.title.toLowerCase().includes('analyze')).length -
        tasks.filter(t => t.title.toLowerCase().includes('blog') || t.title.toLowerCase().includes('write') || t.title.toLowerCase().includes('content')).length -
        tasks.filter(t => t.title.toLowerCase().includes('post') || t.title.toLowerCase().includes('tweet') || t.title.toLowerCase().includes('social')).length -
        tasks.filter(t => t.title.toLowerCase().includes('build') || t.title.toLowerCase().includes('code') || t.title.toLowerCase().includes('fix') || t.title.toLowerCase().includes('create')).length -
        tasks.filter(t => t.title.toLowerCase().includes('deploy') || t.title.toLowerCase().includes('launch') || t.title.toLowerCase().includes('production')).length,
    };
    
    return NextResponse.json({
      totalTasks,
      completedTasks,
      failedTasks,
      pendingTasks,
      executingTasks,
      successRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100,
      avgDuration,
      totalAgents,
      idleAgents,
      executingAgents,
      avgSuccessRate,
      totalTasksCompleted,
      taskTypeBreakdown,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to get analytics' }, { status: 500 });
  }
}

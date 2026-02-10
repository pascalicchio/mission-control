import { NextRequest, NextResponse } from 'next/server';
import { tasksDb, agentsDb } from '@/lib/db';
import { emitTaskUpdate, emitAgentUpdate, emitActivity } from '@/lib/socket';

export async function GET() {
  try {
    const tasks = tasksDb.getAll();
    const agents = agentsDb.getAll();
    return NextResponse.json({ tasks, agents });
  } catch (error) {
    console.error('Failed to fetch data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, priority = 'normal' } = await request.json();
    
    if (!title) {
      return NextResponse.json({ error: 'Title required' }, { status: 400 });
    }

    const taskId = Date.now().toString();
    
    const task = tasksDb.create({
      id: taskId,
      title,
      status: 'pending',
      priority,
      created_at: new Date().toISOString(),
    });

    // Emit real-time update
    emitTaskUpdate('task:created', task);
    emitActivity({
      id: Date.now().toString(),
      type: 'task_created',
      message: `New task: "${title}"`,
      timestamp: task.created_at,
    });

    // Find an available agent
    const allAgents = agentsDb.getAll() as any[];
    const idleAgents = allAgents.filter((a: any) => a.status === 'idle');
    const agent = idleAgents[0] || allAgents[0];

    // Mark agent as busy
    agentsDb.update(agent.id, { 
      status: 'executing', 
      current_task: title,
      last_active: new Date().toISOString(),
    });
    
    // Update task status to executing
    const startedAt = new Date().toISOString();
    tasksDb.update(taskId, { status: 'executing', agent: agent.name, started_at: startedAt });
    
    emitAgentUpdate(agentsDb.getAll());
    emitTaskUpdate('task:updated', { ...task, status: 'executing', agent: agent.name, started_at: startedAt });

    // Trigger execution via the same API endpoint
    fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: title, taskId, priority }),
    }).catch(err => console.error('Execution trigger failed:', err));

    return NextResponse.json({ success: true, task: { ...task, status: 'executing', agent: agent.name } });
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, status, result, agent } = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
    }

    const task = tasksDb.getById(id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updates: Record<string, any> = {};
    
    if (status) {
      updates.status = status;
      
      if (status === 'executing') {
        updates.started_at = new Date().toISOString();
      }
      
      if (status === 'done' || status === 'failed') {
        updates.completed_at = new Date().toISOString();
        const startedAt = (tasksDb.getById(id) as Record<string, any> | undefined)?.started_at;
        if (startedAt) {
          updates.duration = Math.round(
            (new Date().getTime() - new Date(startedAt).getTime()) / 1000
          );
        }
        
        // Mark agent as idle
        if (agent) {
          const agentData = agentsDb.getById(agent.toLowerCase());
          if (agentData) {
            const newTaskCount = (agentData as any).task_count + 1;
            agentsDb.update((agent as any).toLowerCase(), {
              status: 'idle',
              current_task: null,
              last_active: new Date().toISOString(),
              task_count: newTaskCount,
            });
            emitAgentUpdate(agentsDb.getAll());
          }
        }
      }
    }

    if (result) updates.result = result;
    if (agent) updates.agent = agent;

    const updatedTask = tasksDb.update(id, updates);

    // Add interaction
    tasksDb.addInteraction({
      task_id: id,
      agent: agent || 'System',
      action: status || 'updated',
      message: result || `Task ${status}`,
      timestamp: new Date().toISOString(),
    });

    emitTaskUpdate('task:updated', updatedTask);
    emitActivity({
      id: Date.now().toString(),
      type: 'task_updated',
      message: `Task "${(task as any).title}" ${status}`,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error('Failed to update task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id) {
    const task = tasksDb.getById(id);
    if (task) {
      tasksDb.delete(id);
      emitTaskUpdate('task:deleted', { id });
      emitActivity({
        id: Date.now().toString(),
        type: 'task_deleted',
        message: `Task deleted`,
        timestamp: new Date().toISOString(),
      });
    }
  } else {
    tasksDb.clear();
    emitTaskUpdate('task:cleared', {});
  }

  return NextResponse.json({ success: true });
}

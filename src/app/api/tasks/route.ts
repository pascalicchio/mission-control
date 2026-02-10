import { NextRequest, NextResponse } from 'next/server';
import { tasksDb, agentsDb } from '@/lib/db';

export async function GET() {
  try {
    const [tasks, agents] = await Promise.all([tasksDb.getAll(), agentsDb.getAll()]);
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

    const task = await tasksDb.create({
      title,
      status: 'pending',
      priority,
      created_at: new Date().toISOString(),
    });

    // Find an available agent
    const allAgents = await agentsDb.getAll();
    const idleAgents = allAgents.filter(a => a.status === 'idle');
    const agent = idleAgents[0] || allAgents[0];

    // Mark agent as busy
    await agentsDb.update(agent.id, { 
      status: 'executing', 
      current_task: task.title,
      last_active: new Date().toISOString(),
    });
    
    // Update task status to executing
    const startedAt = new Date().toISOString();
    const updatedTask = await tasksDb.update(task.id, { status: 'executing', agent: agent.name, started_at: startedAt });

    // Trigger execution (fire and forget)
    fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: task.title, taskId: task.id, priority }),
    }).catch(err => console.error('Execution trigger failed:', err));

    return NextResponse.json({ success: true, task: updatedTask });
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

    const task = await tasksDb.getById(id);
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
        const startedAt = task.started_at;
        if (startedAt) {
          updates.duration = Math.round(
            (new Date().getTime() - new Date(startedAt).getTime()) / 1000
          );
        }
        
        // Mark agent as idle
        if (agent) {
          const agentData = await agentsDb.getById(agent.toLowerCase());
          if (agentData) {
            const newTaskCount = agentData.task_count + 1;
            await agentsDb.update(agent.toLowerCase(), {
              status: 'idle',
              current_task: undefined,
              last_active: new Date().toISOString(),
              task_count: newTaskCount,
            });
          }
        }
      }
    }

    if (result) updates.result = result;
    if (agent) updates.agent = agent;

    const updatedTask = await tasksDb.update(id, updates);

    // Add interaction
    await tasksDb.addInteraction({
      task_id: id,
      agent: agent || 'System',
      action: status || 'updated',
      message: result || `Task ${status}`,
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
    await tasksDb.delete(id);
  } else {
    await tasksDb.clear();
  }

  return NextResponse.json({ success: true });
}

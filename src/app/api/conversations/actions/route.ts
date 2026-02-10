import { NextRequest, NextResponse } from 'next/server';
import { extractedActionsDb, tasksDb } from '@/lib/db';

// GET extracted actions
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId');
  
  if (conversationId) {
    const actions = await extractedActionsDb.getByConversation(conversationId);
    return NextResponse.json(actions);
  }
  
  const pending = await extractedActionsDb.getPending();
  return NextResponse.json(pending);
}

// POST create task from action
export async function POST(request: NextRequest) {
  const { actionId, title, priority } = await request.json();
  
  // Get all pending actions and find by ID
  const pendingActions = await extractedActionsDb.getPending();
  const action = pendingActions.find((a: any) => a.id === actionId);
  
  if (!action) {
    return NextResponse.json({ error: 'Action not found' }, { status: 404 });
  }
  
  const now = new Date().toISOString();
  
  // Create task from action - link to conversation
  const taskData: any = {
    title: title || action.description,
    status: 'pending',
    priority: priority || 'normal',
    created_at: now,
  };
  
  // Add conversation_id if present
  if (action.conversation_id) {
    taskData['conversation_id'] = action.conversation_id;
  }
  
  const task = await tasksDb.create(taskData);
  
  // Mark action as completed and link to task
  await extractedActionsDb.updateTask(String(action.id), task.id);
  
  // AUTO-EXECUTE: Trigger task execution immediately
  try {
    const execRes = await fetch(new URL('/api/execute', request.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: task.title,
        taskId: task.id,
        priority: task.priority,
      }),
    });
    
    const execData = await execRes.json();
    console.log(`[Actions] Auto-executed task ${task.id}: ${execData.success ? 'success' : 'failed'}`);
  } catch (e: any) {
    console.error('[Actions] Auto-execution failed:', e.message);
  }
  
  return NextResponse.json({
    success: true,
    taskId: task.id,
    task,
  });
}

// PATCH complete action
export async function PATCH(request: NextRequest) {
  const { actionId, status } = await request.json();
  
  if (status === 'completed') {
    await extractedActionsDb.complete(actionId);
  }
  
  return NextResponse.json({ success: true });
}

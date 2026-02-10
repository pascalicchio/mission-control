import { NextRequest, NextResponse } from 'next/server';
import { extractedActionsDb, tasksDb } from '@/lib/db';

// GET extracted actions
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId');
  
  if (conversationId) {
    const actions = extractedActionsDb.getByConversation(conversationId);
    return NextResponse.json(actions);
  }
  
  const pending = extractedActionsDb.getPending();
  return NextResponse.json(pending);
}

// POST create task from action
export async function POST(request: NextRequest) {
  const { actionId, title, priority } = await request.json();
  
  // Get all pending actions and find by ID
  const pendingActions = extractedActionsDb.getPending();
  const action = pendingActions.find((a: any) => a.id === Number(actionId));
  
  if (!action) {
    return NextResponse.json({ error: 'Action not found' }, { status: 404 });
  }
  
  // Create task from action
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  tasksDb.create({
    id: taskId,
    title: title || action.description,
    status: 'pending',
    priority: priority || 'normal',
    created_at: now,
  });
  
  // Mark action as completed
  extractedActionsDb.complete(String(action.id));
  
  return NextResponse.json({
    success: true,
    taskId,
    task: tasksDb.getById(taskId),
  });
}

// PATCH complete action
export async function PATCH(request: NextRequest) {
  const { actionId, status } = await request.json();
  
  if (status === 'completed') {
    extractedActionsDb.complete(actionId);
  }
  
  return NextResponse.json({ success: true });
}

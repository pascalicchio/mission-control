import { NextRequest, NextResponse } from 'next/server';
import { tasksDb } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const task = tasksDb.getById(params.id);
    
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get interactions for this task
    const interactions = tasksDb.getInteractions(params.id);

    return NextResponse.json({
      task: {
        ...task,
        interactions,
      },
    });
  } catch (error) {
    console.error('Failed to fetch task:', error);
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { conversationsDb, extractedActionsDb, agentsDb } from '@/lib/db';

// GET all conversations
export async function GET() {
  const conversations = conversationsDb.getAll();
  return NextResponse.json(conversations);
}

// POST create new conversation
export async function POST(request: NextRequest) {
  const { title, topic, participants } = await request.json();
  
  const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const conversation = conversationsDb.create({
    id,
    title,
    topic,
    participants: JSON.stringify(participants),
  });
  
  return NextResponse.json({ success: true, conversation });
}

// DELETE all conversations
export async function DELETE() {
  const conversations = conversationsDb.getAll();
  for (const conv of conversations as any[]) {
    conversationsDb.delete(conv.id);
  }
  return NextResponse.json({ success: true, message: 'All conversations deleted' });
}

import { NextRequest, NextResponse } from 'next/server';
import { conversationsDb } from '@/lib/db';

// GET all conversations
export async function GET() {
  const conversations = await conversationsDb.getAll();
  return NextResponse.json(conversations);
}

// POST create new conversation
export async function POST(request: NextRequest) {
  const { title, topic, participants } = await request.json();
  
  const conversation = await conversationsDb.create({
    title,
    topic,
    participants: JSON.stringify(participants),
  });
  
  return NextResponse.json({ success: true, conversation });
}

// DELETE all conversations
export async function DELETE() {
  const conversations = await conversationsDb.getAll();
  for (const conv of conversations) {
    await conversationsDb.delete(conv.id);
  }
  return NextResponse.json({ success: true, message: 'All conversations deleted' });
}

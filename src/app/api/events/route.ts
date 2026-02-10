import { NextRequest, NextResponse } from 'next/server';
import { getRecentEvents, getAgentLearnings } from '../../../lib/proposal-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const days = parseInt(searchParams.get('days') || '7');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    if (agentId) {
      const learnings = await getAgentLearnings(agentId, days);
      return NextResponse.json({ learnings });
    }
    
    const events = await getRecentEvents(limit);
    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

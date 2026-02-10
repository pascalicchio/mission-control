import { NextRequest, NextResponse } from 'next/server';
import { getActiveMissions, completeStep } from '../../../lib/proposal-service';

export async function GET() {
  try {
    const missions = await getActiveMissions();
    return NextResponse.json({ missions });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch missions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { step_id, result } = body;
    
    if (!step_id || !result) {
      return NextResponse.json({ error: 'Missing step_id or result' }, { status: 400 });
    }
    
    const event = await completeStep(step_id, result);
    if (!event) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, event });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to complete step' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createProposalAndMaybeAutoApprove, getPendingProposals, approveProposal, rejectProposal } from '../../../lib/proposal-service';

export async function GET() {
  try {
    const proposals = await getPendingProposals();
    return NextResponse.json({ proposals });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch proposals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent_id, agent_name, title, description, proposed_steps, kind, auto_approve_low_risk } = body;
    
    if (!agent_id || !title || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const result = await createProposalAndMaybeAutoApprove({
      agent_id,
      agent_name: agent_name || 'Unknown',
      title,
      description,
      proposed_steps: proposed_steps || [],
      kind,
      auto_approve_low_risk: auto_approve_low_risk !== false,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Proposal creation error:', error);
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, proposal_id, reason } = body;
    
    if (action === 'approve') {
      const result = await approveProposal(proposal_id);
      if (!result) {
        return NextResponse.json({ error: 'Proposal not found or already processed' }, { status: 404 });
      }
      return NextResponse.json(result);
    }
    
    if (action === 'reject') {
      const success = await rejectProposal(proposal_id, reason || 'Rejected by human');
      if (!success) {
        return NextResponse.json({ error: 'Proposal not found or already processed' }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process proposal' }, { status: 500 });
  }
}

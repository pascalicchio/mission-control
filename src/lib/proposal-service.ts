// proposal-service.ts - The Hub of the Entire System
// Implements the closed loop from @voxyz_ai

import { proposalsDb, missionsDb, stepsDb, eventsDb, affinityDb, limitsDb, agentsDb } from './db';

interface AgentEvent {
  id: string;
  agent_id: string;
  agent_name: string;
  kind: 'proposal_created' | 'mission_approved' | 'step_completed' | 'milestone' | 'decision' | 'learning';
  title: string;
  summary: string;
  tags: string[];
  created_at: string;
}

interface ProposalInput {
  agent_id: string;
  agent_name: string;
  title: string;
  description: string;
  proposed_steps: string[];
  kind?: 'draft_tweet' | 'crawl' | 'analyze' | 'research' | 'test' | 'build' | 'deploy' | 'other';
  auto_approve_low_risk?: boolean;
}

interface ProposalResult {
  proposal: any;
  mission?: any;
  steps: any[];
  auto_approved: boolean;
  rejected: boolean;
  reason?: string;
}

/**
 * The single entry point for proposal creation
 * No matter where a proposal comes from — agent initiative, automatic trigger, 
 * or another agent's reaction — everything goes through this function.
 */
export async function createProposalAndMaybeAutoApprove(input: ProposalInput): Promise<ProposalResult> {
  // 1. Check agent daily limits
  const limitCheck = await limitsDb.checkAndIncrement(input.agent_id);
  if (!limitCheck.allowed) {
    return {
      proposal: null,
      steps: [],
      auto_approved: false,
      rejected: true,
      reason: 'Daily proposal limit reached',
    };
  }
  
  // 2. Create the proposal
  const proposal = await proposalsDb.create({
    agent_id: input.agent_id,
    agent_name: input.agent_name,
    title: input.title,
    description: input.description,
    proposed_steps: input.proposed_steps,
  });
  
  // 3. Evaluate auto-approve (low-risk tasks pass automatically)
  const shouldAutoApprove = await evaluateAutoApprove(input, limitCheck.remaining);
  
  if (shouldAutoApprove.approved) {
    // Auto-approve the proposal
    await proposalsDb.autoApprove(proposal.id);
    proposal.status = 'accepted';
    proposal.auto_approved = true;
    
    // Create mission from proposal
    const mission = await missionsDb.create({
      proposal_id: proposal.id,
      title: proposal.title,
      description: proposal.description,
      created_by: proposal.agent_name,
    });
    
    // Create steps from proposed_steps
    const steps: any[] = [];
    for (const stepDesc of proposal.proposed_steps) {
      const step = await stepsDb.create({
        mission_id: mission.id,
        kind: input.kind || 'other',
        description: stepDesc,
      });
      steps.push(step);
    }
    
    // Fire event for mission creation
    await eventsDb.create({
      agent_id: proposal.agent_id,
      agent_name: proposal.agent_name,
      kind: 'mission_approved',
      title: `Auto-approved: ${proposal.title}`,
      summary: `Mission created with ${steps.length} steps`,
      tags: ['auto-approved', proposal.agent_id, 'mission'],
    });
    
    return {
      proposal,
      mission,
      steps,
      auto_approved: true,
      rejected: false,
    };
  }
  
  // Not auto-approved - return pending for human review
  return {
    proposal,
    steps: [],
    auto_approved: false,
    rejected: false,
  };
}

/**
 * Evaluate if a proposal should be auto-approved
 * Low-risk tasks include: research, analysis, drafting
 * High-risk tasks include: posting, deploying, spending money
 */
async function evaluateAutoApprove(input: ProposalInput, remainingQuota: number): Promise<{ approved: boolean; reason?: string }> {
  if (!input.auto_approve_low_risk) {
    return { approved: false, reason: 'Manual review required' };
  }
  
  // High-risk kinds that require human approval
  const highRiskKinds = ['post', 'deploy', 'build'];
  const lowRiskKinds = ['research', 'analyze', 'crawl', 'draft_tweet', 'test'];
  
  if (highRiskKinds.includes(input.kind || '')) {
    return { approved: false, reason: `${input.kind} requires human approval` };
  }
  
  // Low-risk kinds can be auto-approved
  if (lowRiskKinds.includes(input.kind || '')) {
    // Check if we have quota
    if (remainingQuota <= 0) {
      return { approved: false, reason: 'Quota exhausted' };
    }
    return { approved: true, reason: 'Low-risk task auto-approved' };
  }
  
  // Default: require approval for unknown kinds
  return { approved: false, reason: 'Unknown task kind - manual review' };
}

/**
 * Approve a proposal manually (human decision)
 */
export async function approveProposal(proposalId: string): Promise<{ mission: any; steps: any[] } | null> {
  const proposal = await proposalsDb.getById(proposalId);
  if (!proposal || proposal.status !== 'pending') {
    return null;
  }
  
  // Update proposal status
  await proposalsDb.updateStatus(proposalId, 'accepted', 'Approved by human');
  
  // Create mission
  const mission = await missionsDb.create({
    proposal_id: proposal.id,
    title: proposal.title,
    description: proposal.description,
    created_by: proposal.agent_name,
  });
  
  // Create steps
  const steps: any[] = [];
  for (const stepDesc of proposal.proposed_steps) {
    const step = await stepsDb.create({
      mission_id: mission.id,
      kind: 'other',
      description: stepDesc,
    });
    steps.push(step);
  }
  
  // Fire event
  await eventsDb.create({
    agent_id: proposal.agent_id,
    agent_name: proposal.agent_name,
    kind: 'mission_approved',
    title: `Approved: ${proposal.title}`,
    summary: `Human approved mission with ${steps.length} steps`,
    tags: ['approved', 'human', proposal.agent_id],
  });
  
  return { mission, steps };
}

/**
 * Reject a proposal
 */
export async function rejectProposal(proposalId: string, reason: string): Promise<boolean> {
  const proposal = await proposalsDb.getById(proposalId);
  if (!proposal || proposal.status !== 'pending') {
    return false;
  }
  
  await proposalsDb.updateStatus(proposalId, 'rejected', reason);
  
  // Fire event
  await eventsDb.create({
    agent_id: proposal.agent_id,
    agent_name: proposal.agent_name,
    kind: 'decision',
    title: `Rejected: ${proposal.title}`,
    summary: reason,
    tags: ['rejected', proposal.agent_id],
  });
  
  return true;
}

/**
 * Complete a step and potentially trigger new proposals
 */
export async function completeStep(stepId: string, result: string): Promise<AgentEvent | null> {
  const step = await stepsDb.getById(stepId);
  if (!step) return null;
  
  await stepsDb.updateStatus(stepId, 'succeeded', result);
  
  // Fire event
  const event = await eventsDb.create({
    agent_id: 'system',
    agent_name: 'System',
    kind: 'step_completed',
    title: `Step completed: ${step.description}`,
    summary: result.substring(0, 200),
    tags: ['step', 'completed', step.mission_id],
  });
  
  // Check if mission is complete
  const missionSteps = await stepsDb.getByMission(step.mission_id);
  const allDone = missionSteps.every(s => s.status === 'succeeded' || s.status === 'failed');
  
  if (allDone) {
    const mission = await missionsDb.getById(step.mission_id);
    if (mission) {
      await missionsDb.updateStatus(step.mission_id, 'succeeded', 'All steps completed');
      
      // Fire milestone event
      await eventsDb.create({
        agent_id: mission.created_by,
        agent_name: mission.created_by,
        kind: 'milestone',
        title: `Mission complete: ${mission.title}`,
        summary: `All ${missionSteps.length} steps succeeded`,
        tags: ['milestone', 'mission-complete', mission.id],
      });
    }
  }
  
  return event;
}

/**
 * Get learnings for an agent (from event stream)
 */
export async function getAgentLearnings(agentId: string, days: number = 7) {
  const events = await eventsDb.getLearnings(agentId, days);
  
  // Extract patterns from events
  const learnings = events
    .filter(e => e.kind === 'step_completed' || e.kind === 'milestone')
    .map(e => ({
      what: e.title,
      when: e.created_at,
      tags: e.tags,
    }));
  
  return learnings;
}

/**
 * Update affinity between two agents after collaboration
 */
export async function updateCollaborationAffinity(agentA: string, agentB: string, positive: boolean) {
  const delta = positive ? 5 : -5;
  await affinityDb.updateScore(agentA, agentB, delta);
}

/**
 * Get pending proposals for human review
 */
export async function getPendingProposals() {
  return proposalsDb.getPending();
}

/**
 * Get active missions
 */
export async function getActiveMissions() {
  const missions = await missionsDb.getAll();
  return missions.filter(m => m.status === 'approved' || m.status === 'running');
}

/**
 * Get recent events (for the frontend pixel-art office visualization)
 */
export async function getRecentEvents(limit: number = 20) {
  return eventsDb.getRecent(limit);
}

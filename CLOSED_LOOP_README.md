# 🎯 Closed Loop System - Based on @voxyz_ai

This system implements the 4-table closed loop architecture for autonomous agent operations.

## The Core Data Model

```
Proposal → Mission → Step → Event → (back to) Proposal
```

### 4 Tables

1. **proposals** - Agent requests ("I want to tweet about AI")
2. **missions** - Approved executable projects
3. **steps** - Concrete actions (draft_tweet, crawl, analyze, etc.)
4. **events** - Event stream for memory/learning

## API Endpoints

### Proposals
- `GET /api/proposals` - Get pending proposals
- `POST /api/proposals` - Create new proposal
- `PUT /api/proposals` - Approve/reject proposal

### Missions
- `GET /api/missions` - Get active missions
- `POST /api/missions` - Complete a step

### Events
- `GET /api/events` - Get recent events (for frontend visualization)
- `GET /api/events?agent_id=loki&days=7` - Get agent learnings

## Usage Example

```typescript
import { createProposalAndMaybeAutoApprove, approveProposal } from './lib/proposal-service';

// Agent creates a proposal
const result = await createProposalAndMaybeAutoApprove({
  agent_id: 'loki',
  agent_name: 'Loki',
  title: 'Research AI trends',
  description: 'Find latest AI news for our blog',
  proposed_steps: ['Search X for AI news', 'Summarize findings', 'Draft blog outline'],
  kind: 'research',
  auto_approve_low_risk: true,
});

// If auto-approved, mission and steps are created immediately
if (result.auto_approved) {
  console.log('Mission created:', result.mission.title);
  console.log('Steps:', result.steps.length);
}

// Or manually approve via dashboard
await approveProposal(proposalId);
```

## Key Features

### 1. Single Proposal Intake Pipeline
All proposals — from agent initiative, triggers, or other agents — go through the same function. No duplicate work.

### 2. Daily Limits per Agent
Prevents runaway agents. Default: 10 proposals/day per agent.

### 3. Auto-Approve for Low-Risk Tasks
- ✅ Research, analysis, crawling, drafting → Auto-approved
- ⚠️ Posting, deploying, spending → Require human approval

### 4. Event Stream for Learning
Agents can query their past events to learn from outcomes.

### 5. Collaboration Affinity
- Agents track collaboration scores
- Work together more → affinity goes up
- Argue too much → affinity drops

## Agent Learnings

```typescript
// Get what an agent learned in the last 7 days
const learnings = await getAgentLearnings('loki', 7);
// Returns array of { what, when, tags }
```

## Frontend Integration

The event stream powers a "pixel-art office" visualization showing:
- Real-time agent activity
- Mission progress
- Proposals awaiting review

## Based On

@voxyz_ai's "6 AI Agents That Run a Company" tutorial
- 5,600 words, every step公开
- Next.js + Supabase + VPS
- Monthly cost: $8 fixed + LLM usage

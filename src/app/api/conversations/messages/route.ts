import { NextRequest, NextResponse } from 'next/server';
import { conversationsDb, extractedActionsDb } from '@/lib/db';

// GET messages for a conversation or all conversations
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId');
  
  if (conversationId) {
    const conversation = await conversationsDb.getById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    const messages = await conversationsDb.getMessages(conversationId);
    const actions = await extractedActionsDb.getByConversation(conversationId);
    
    return NextResponse.json({ conversation, messages, actions });
  }
  
  const conversations = await conversationsDb.getAll();
  return NextResponse.json(conversations);
}

// POST add message to conversation
export async function POST(request: NextRequest) {
  try {
    const { conversationId, agentId, agentName, agentEmoji, message } = await request.json();
    
    const conversation = await conversationsDb.getById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    const turn = conversation.turns + 1;
    
    await conversationsDb.addMessage({
      conversation_id: conversationId,
      turn,
      agent_id: agentId,
      agent_name: agentName,
      agent_emoji: agentEmoji,
      message,
    });
    
    return NextResponse.json({ success: true, turn });
  } catch (error) {
    console.error('Failed to add message:', error);
    return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
  }
}

// PUT start bot standup (create conversation)
export async function PUT(request: NextRequest) {
  const { topic, participants } = await request.json();
  
  const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Bot personas for variety
  const personas: Record<string, { emoji: string; style: string }> = {
    loki: { emoji: '🦇', style: 'research-focused, analytical, curious' },
    wanda: { emoji: '🩸', style: 'social-savvy, trendy, engaging' },
    pulse: { emoji: '💜', style: 'creative, expressive, storytelling' },
    vision: { emoji: '💎', style: 'strategic, analytical, composed' },
    friday: { emoji: '🤖', style: 'technical, efficient, problem-solver' },
    jocasta: { emoji: '👩‍💻', style: 'systematic, organized, methodical' },
    fury: { emoji: '👁️', style: 'critical, detail-oriented, thorough' },
    maria: { emoji: '👩‍✈️', style: 'logistical, efficient, coordinator' },
    phil: { emoji: '🕷️', style: 'deploy-focused, practical, hands-on' },
    miles: { emoji: '🕸️', style: 'creative, visual, aesthetic' },
  };
  
  // Generate bot responses based on topic
  const responses: Record<string, string[]> = {
    loki: [
      "I've been digging into the data and found some fascinating patterns. Our engagement peaks around 2PM EST.",
      "Research shows that concise content with bold visuals gets 40% more shares.",
      "I can pull competitor analysis if we want to benchmark our approach.",
    ],
    wanda: [
      "I've noticed our audience loves behind-the-scenes content! Let's lean into that.",
      "The trending hashtags right now align perfectly with our brand voice.",
      "I can craft some engaging posts around this topic that will resonate with our followers.",
    ],
    pulse: [
      "Great topic! I already have angles for a blog post and newsletter.",
      "This could make an amazing case study - real results speak louder than claims.",
      "I'll draft some compelling copy that tells our story authentically.",
    ],
    vision: [
      "Looking at the big picture, this initiative supports our Q2 goals perfectly.",
      "Let's ensure we measure the right KPIs to track success accurately.",
      "I see synergies with our upcoming product launch - we should coordinate.",
    ],
    friday: [
      "I've got the infrastructure ready. What specific features do we need?",
      "I can prototype this quickly and iterate based on feedback.",
      "Let's make sure we have proper error handling and logging from day one.",
    ],
    jocasta: [
      "I've scheduled the planning meeting and sent calendar invites to all stakeholders.",
      "The workflow is documented and tasks are assigned. Ready to execute.",
      "I'll set up automated reminders to keep everyone on track.",
    ],
    fury: [
      "I've reviewed the existing work and found a few gaps we should address.",
      "Let's double-check our assumptions before moving forward.",
      "I recommend we A/B test this approach before full rollout.",
    ],
    maria: [
      "The integration points are clear. I'll sync up with the other teams.",
      "Data flow is configured. We can start collecting metrics immediately.",
      "I'll make sure our APIs are properly documented and secured.",
    ],
    phil: [
      "Deployment pipeline is ready. We can go live as soon as testing passes.",
      "I've configured the staging environment for QA review.",
      "Let's ensure we have rollback procedures in place before launch.",
    ],
    miles: [
      "I've sketched some visual concepts that would work beautifully here.",
      "The brand guidelines are followed - this will look polished and professional.",
      "I'll create some eye-catching assets for social sharing.",
    ],
  };
  
  // Create conversation
  const conversation = await conversationsDb.create({
    title: `Standup: ${topic}`,
    topic,
    participants: JSON.stringify(participants),
  });
  
  // Simulate conversation turns with variety
  for (let turn = 1; turn <= 5; turn++) {
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];
      const persona = personas[participant] || { emoji: '🤖', style: 'helpful' };
      const messages = responses[participant] || ["I think we should explore this further.", "Let me know how I can help with this."];
      
      // Use turn + participant index to pick different messages each turn
      const messageIndex = (turn * (i + 1)) % messages.length;
      const message = messages[messageIndex];
      
      await conversationsDb.addMessage({
        conversation_id: id,
        turn,
        agent_id: participant,
        agent_name: participant.charAt(0).toUpperCase() + participant.slice(1),
        agent_emoji: persona.emoji,
        message,
      });
      
      // Small delay for realism
      await new Promise(r => setTimeout(r, 50));
    }
  }
  
  // Extract action items
  const topics: Record<string, { owner: string; category: string; confidence: number }> = {
    research: { owner: 'loki', category: 'research', confidence: 0.85 },
    content: { owner: 'pulse', category: 'content', confidence: 0.90 },
    social: { owner: 'wanda', category: 'social', confidence: 0.88 },
    technical: { owner: 'friday', category: 'development', confidence: 0.92 },
    design: { owner: 'miles', category: 'design', confidence: 0.87 },
    deployment: { owner: 'phil', category: 'deployment', confidence: 0.91 },
    review: { owner: 'fury', category: 'review', confidence: 0.82 },
  };
  
  // Generate 2-4 action items
  const actionCount = 2 + Math.floor(Math.random() * 3);
  const actionTopics = Object.keys(topics).slice(0, actionCount);
  
  for (const actionTopic of actionTopics) {
    const topic = topics[actionTopic];
    const descriptions = [
      `Research and analyze ${actionTopic} opportunities for this initiative`,
      `Create ${actionTopic} plan with measurable goals`,
      `Execute ${actionTopic} tasks and track progress`,
      `Review ${actionTopic} results and optimize approach`,
    ];
    
    await extractedActionsDb.create({
      conversation_id: id,
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      owner: topic.owner,
      category: topic.category,
      confidence: topic.confidence,
      source_agent: participants[Math.floor(Math.random() * participants.length)],
    });
  }
  
  const conversationUpdated = await conversationsDb.getById(id);
  const messages = await conversationsDb.getMessages(id);
  const actions = await extractedActionsDb.getByConversation(id);
  
  return NextResponse.json({
    success: true,
    conversation: conversationUpdated,
    messages,
    actions,
  });
}

// DELETE close or delete conversation
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'close';
  const conversationId = searchParams.get('id');
  
  if (!conversationId) {
    return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
  }
  
  if (action === 'delete') {
    await conversationsDb.delete(conversationId);
  } else {
    await conversationsDb.close(conversationId);
  }
  
  return NextResponse.json({ success: true });
}

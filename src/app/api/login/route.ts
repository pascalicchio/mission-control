import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';

// Simple password check - in production, use a secure password hash
const MISSION_PASSWORD = process.env.MISSION_PASSWORD || 'hackerstack2026';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (password !== MISSION_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid access code' },
        { status: 401 }
      );
    }

    // Create JWT token
    const secret = new TextEncoder().encode('mission-control-secret-key');
    const token = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(secret);

    return NextResponse.json({ 
      success: true, 
      token,
      message: 'Welcome to Mission Control, Mr. Anderson.' 
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Check for valid token
  const token = cookies().get('mission_token')?.value;
  
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({ valid: true });
}

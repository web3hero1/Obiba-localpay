import { NextRequest, NextResponse } from 'next/server';
import { nearIntents } from '@/lib/near-intents';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const intentId = body.intentId;
    if (!intentId) throw new Error('Missing intentId');

    const intent = nearIntents.stepLifecycle(intentId);
    return NextResponse.json(intent);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

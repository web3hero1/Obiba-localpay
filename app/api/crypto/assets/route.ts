import { NextResponse } from 'next/server';
import { nearIntents } from '@/lib/near-intents';

export async function GET() {
  try {
    const assets = nearIntents.getSupportedAssets();
    return NextResponse.json({ assets });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

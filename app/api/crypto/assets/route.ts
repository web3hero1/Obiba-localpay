import { NextRequest, NextResponse } from 'next/server';
import { nearIntents } from '@/lib/near-intents';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const envParam = searchParams.get('environment');
    const environment = envParam === 'mainnet' ? 'mainnet' : 'testnet';
    const assets = nearIntents.getSupportedAssets(environment);
    return NextResponse.json({ assets, environment });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

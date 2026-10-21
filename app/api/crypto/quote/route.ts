import { NextRequest, NextResponse } from 'next/server';
import { nearIntents } from '@/lib/near-intents';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const asset = body.asset || 'SOL';
    const amount = parseFloat(body.amount) || 1.0;
    const environment = body.environment === 'mainnet' ? 'mainnet' : 'testnet';
    const quote = await nearIntents.getQuote(asset, amount, environment);
    return NextResponse.json(quote);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

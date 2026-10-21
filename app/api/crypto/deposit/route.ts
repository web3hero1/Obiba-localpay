import { NextRequest, NextResponse } from 'next/server';
import { nearIntents } from '@/lib/near-intents';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body.userId || 'user_gh_founder';
    const assetSymbol = body.asset || 'SOL';
    const amount = parseFloat(body.amount) || 1.0;
    const environment = body.environment === 'mainnet' ? 'mainnet' : 'testnet';
    const network = body.network || (environment === 'testnet' ? 'Solana Devnet' : 'Solana Mainnet');

    const intent = await nearIntents.createDepositIntent({
      userId,
      assetSymbol,
      amount,
      network,
      environment,
    });

    return NextResponse.json(intent);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const intentId = searchParams.get('intentId');
    if (!intentId) throw new Error('Missing intentId parameter');

    const intent = nearIntents.getIntent(intentId);
    return NextResponse.json(intent);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { nearIntents } from '@/lib/near-intents';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = 'user_gh_founder';
    const assetSymbol = body.asset || 'SOL';
    const amount = parseFloat(body.amount) || 1.0;
    const network = body.network || 'Solana Mainnet';

    const intent = await nearIntents.createDepositIntent({
      userId,
      assetSymbol,
      amount,
      network,
    });

    return NextResponse.json(intent);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

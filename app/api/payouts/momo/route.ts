import { NextRequest, NextResponse } from 'next/server';
import { ghanaRails } from '@/lib/ghana-rails';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = 'user_gh_founder';
    const provider = body.provider || 'MTN';
    const recipientPhone = body.phone || '0559876543';
    const amountGhs = parseFloat(body.amountGhs) || 50.0;

    const result = ghanaRails.payoutToMomo({
      userId,
      provider,
      recipientPhone,
      amountGhs,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { ghanaRails } from '@/lib/ghana-rails';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = 'user_gh_founder';
    const meterNumber = body.meterNumber || '482019-2041';
    const amountGhs = parseFloat(body.amountGhs) || 100.0;

    const result = ghanaRails.payEcgBill({
      userId,
      meterNumber,
      amountGhs,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

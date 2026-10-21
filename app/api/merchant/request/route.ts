import { NextRequest, NextResponse } from 'next/server';
import { ghanaRails } from '@/lib/ghana-rails';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const merchantName = body.merchantName || 'Starbites Osu';
    const category = body.category || 'Food & Dining';
    const amountGhs = parseFloat(body.amountGhs) || 150.0;

    const request = ghanaRails.createMerchantRequest(merchantName, category, amountGhs);
    return NextResponse.json(request);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

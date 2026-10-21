import { NextRequest, NextResponse } from 'next/server';
import { ghanaRails } from '@/lib/ghana-rails';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = 'user_gh_founder';
    const category = body.category || 'AIRTIME';
    const provider = body.provider || 'MTN';
    const phone = body.phone || '0241234567';
    const amountGhs = parseFloat(body.amountGhs) || 20.0;
    const bundleName = body.bundleName;

    const result = ghanaRails.rechargeTelecom({
      userId,
      category,
      provider,
      phone,
      amountGhs,
      bundleName,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

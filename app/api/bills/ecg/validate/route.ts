import { NextRequest, NextResponse } from 'next/server';
import { ghanaRails } from '@/lib/ghana-rails';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const meterNumber = body.meterNumber || '482019-2041';
    const validation = ghanaRails.validateMeter(meterNumber);
    return NextResponse.json(validation);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

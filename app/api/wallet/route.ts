import { NextResponse } from 'next/server';
import { ledger } from '@/lib/ledger';

export async function GET() {
  try {
    const userId = 'user_gh_founder';
    const balance = ledger.getUserBalance(userId);
    return NextResponse.json(balance);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

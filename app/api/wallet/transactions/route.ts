import { NextResponse } from 'next/server';
import { ghanaRails } from '@/lib/ghana-rails';

export async function GET() {
  try {
    const userId = 'user_gh_founder';
    const txs = ghanaRails.getTransactions(userId);
    return NextResponse.json({ transactions: txs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

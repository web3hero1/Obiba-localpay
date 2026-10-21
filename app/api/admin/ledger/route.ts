import { NextResponse } from 'next/server';
import { ledger, ASSET_USDC_SETTLEMENT, REVENUE_CONVERSION_FEES } from '@/lib/ledger';

export async function GET() {
  try {
    const journals = ledger.getRecentJournals(50);
    const custodyPoolUsdc = ledger.getAccountBalance(ASSET_USDC_SETTLEMENT) / 1_000_000;
    const feeRevenueUsdc = ledger.getAccountBalance(REVENUE_CONVERSION_FEES) / 1_000_000;

    return NextResponse.json({
      custodyPoolUsdc,
      feeRevenueUsdc,
      totalJournals: journals.length,
      journals,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

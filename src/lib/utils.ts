import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Platform mapping function for consistent display across the app
export function getPlatformDisplayName(platform: string): string {
  const platformMap: Record<string, string> = {
    MT4: 'MetaTrader 4',
    MT5: 'MetaTrader 5',
    CTRADER: 'cTrader',
    CT: 'cTrader',
    cTrader: 'cTrader',
    TradingView: 'TradingView',
    NinjaTrader: 'NinjaTrader',
    NT8: 'NinjaTrader 8',
    Other: 'Other Platform',
    mt4: 'MetaTrader 4',
    mt5: 'MetaTrader 5',
  };
  return platformMap[platform?.toUpperCase()] || platform || 'Unknown';
}

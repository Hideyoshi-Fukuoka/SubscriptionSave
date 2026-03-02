import { supabase } from '../utils/supabaseClient';

const USAGE_KEY = '__system_api_usage__';

// デフォルトの予算上限: 1,000,000 トークン (約0.3ドル)
const DEFAULT_MAX_TOKENS = 1000000;

export const checkBudgetAndThrow = async () => {
    const maxTokens = process.env.MAX_TOKENS_BUDGET ? parseInt(process.env.MAX_TOKENS_BUDGET, 10) : DEFAULT_MAX_TOKENS;

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return;

    const { data, error } = await supabase
        .from('subscription_cache')
        .select('price')
        .eq('subscription_name', USAGE_KEY)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "Rows not found", which is ok for initial state
        console.error('Supabase Budget Check Error:', error);
        return;
    }

    const currentUsage = data ? (data.price || 0) : 0;

    if (currentUsage >= maxTokens) {
        console.warn(`[Billing] Budget limit reached. Usage: ${currentUsage}, Limit: ${maxTokens}`);
        const err: any = new Error('トークンの月間/総予算上限（APIリミット）に到達しました。安全のためシステムを一時停止しています。');
        err.status = 429;
        throw err;
    }
};

export const recordUsage = async (tokens: number) => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || tokens <= 0) return;

    try {
        const { data, error } = await supabase
            .from('subscription_cache')
            .select('price')
            .eq('subscription_name', USAGE_KEY)
            .single();

        const currentUsage = (data && !error) ? (data.price || 0) : 0;
        const newUsage = currentUsage + tokens;

        await supabase
            .from('subscription_cache')
            .upsert({
                subscription_name: USAGE_KEY,
                price: newUsage,
                experts: null,
                future_analysis: null,
                created_at: new Date().toISOString()
            }, { onConflict: 'subscription_name' });

        console.log(`[Billing] API tokens recorded: +${tokens} -> Total Usage: ${newUsage}`);
    } catch (err) {
        console.error('Supabase Record Usage Error:', err);
    }
};

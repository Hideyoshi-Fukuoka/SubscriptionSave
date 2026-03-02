import { supabase } from '../utils/supabaseClient';
import { ExpertData, FutureValueAnalysis } from './gemini';

export interface SubscriptionCache {
    subscription_name: string;
    price: number | null;
    future_analysis: FutureValueAnalysis | null;
    experts: ExpertData[] | null;
    created_at: string;
}

// 7日間（単位: ミリ秒）キャッシュを有効とする
const CACHE_VALID_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * サブスクリプション名を正規化（小文字化・スペース除去）する
 */
export const normalizeSubName = (name: string): string => {
    return name.toLowerCase().replace(/\s+/g, '');
};

/**
 * Supabaseから有効なキャッシュを取得する
 */
export const getCache = async (subName: string): Promise<SubscriptionCache | null> => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return null;

    const normalizedName = normalizeSubName(subName);

    try {
        const { data, error } = await supabase
            .from('subscription_cache')
            .select('*')
            .eq('subscription_name', normalizedName)
            .single();

        if (error || !data) return null;

        // キャッシュの有効期限チェック（7日経過していたら無視する）
        const createdAt = new Date(data.created_at).getTime();
        const now = Date.now();
        if (now - createdAt > CACHE_VALID_DURATION_MS) {
            console.log(`Cache expired for ${normalizedName}`);
            return null;
        }

        console.log(`Cache HIT for ${normalizedName}`);
        return data as SubscriptionCache;

    } catch (err) {
        console.error('Supabase getCache Error:', err);
        return null;
    }
};

/**
 * Supabaseにキャッシュを保存（あるいは更新）する
 */
export const setCache = async (
    subName: string,
    price: number | null,
    futureAnalysis: FutureValueAnalysis | null,
    experts: ExpertData[] | null
): Promise<void> => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return;

    const normalizedName = normalizeSubName(subName);

    try {
        const payload = {
            subscription_name: normalizedName,
            price,
            future_analysis: futureAnalysis,
            experts,
            created_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('subscription_cache')
            .upsert(payload, { onConflict: 'subscription_name' });

        if (error) {
            console.error('Supabase setCache Insert Error:', error);
        } else {
            console.log(`Cache updated for ${normalizedName}`);
        }
    } catch (err) {
        console.error('Supabase setCache Error:', err);
    }
};

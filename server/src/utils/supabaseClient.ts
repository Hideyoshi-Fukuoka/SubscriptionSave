import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

// 接続情報がない場合は警告を出しつつもアプリ自体はクラッシュさせない
if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ SUPABASE_URL or SUPABASE_ANON_KEY is missing. Cache feature will be disabled.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

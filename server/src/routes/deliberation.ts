import { Router, Request, Response } from 'express';
import { streamUnifiedDeliberation, fetchSubscriptionPrice, fetchSubscriptionFutureValue, ExpertData, FutureValueAnalysis } from '../services/gemini';
import { getCache, setCache } from '../services/cache';
import { checkBudgetAndThrow } from '../services/billing';

const router = Router();

// 仮のインメモリセッションストア
const sessions = new Map<string, any>();

// POST /api/v1/deliberation/initiate
// ユーザーの入力をもとにOrchestratorが3名の専門家を選出し、セッションを確立する
router.post('/initiate', async (req: Request, res: Response) => {
    try {
        await checkBudgetAndThrow();
        const { subscription_id, name, category, price, user_context } = req.body;

        // まずSupabaseキャッシュをチェックする
        const cache = await getCache(name);

        const sessionId = `delib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const sessionData = {
            id: sessionId,
            target: name,
            category,
            price,
            user_context,
            experts: cache?.experts || null,
            futureAnalysis: cache?.future_analysis || null,
            status: 'initialized'
        };

        sessions.set(sessionId, sessionData);

        return res.status(200).json({
            session_id: sessionId,
            message: 'Session initiated successfully',
            expert_selection: cache?.experts || [],
            future_analysis: cache?.future_analysis || null
        });

    } catch (error: any) {
        console.error('Initiate Error:', error);
        return res.status(error.status || 500).json({ error: error.message || 'Failed to initiate deliberation' });
    }
});

// GET /api/v1/deliberation/price
// Google Search Groundingを利用して、指定されたサブスクリプションの最新料金を取得する
router.get('/price', async (req: Request, res: Response) => {
    try {
        await checkBudgetAndThrow();
        const name = req.query.name as string;
        if (!name) {
            return res.status(400).json({ error: 'Subscription name is required' });
        }

        const cache = await getCache(name);
        if (cache && cache.price !== null && cache.price !== undefined) {
            console.log(`Returning cached price for ${name}`);
            // キャッシュにあった場合は、そのキャッシュのキー名を正式名称として返す
            return res.status(200).json({ price: cache.price, formal_name: cache.subscription_name });
        }

        const result = await fetchSubscriptionPrice(name);

        if (result !== null) {
            // 他のキャッシュデータ（エキスパート等）を消さずに上書き保存するため、
            // API呼び出し直前に取得したcacheの状態を引き継ぐ
            // キャッシュのキーには、推測された正式名称（formal_name）を使用する
            setCache(result.formal_name, result.price, cache?.future_analysis || null, cache?.experts || null)
                .catch(e => console.error("Cache Save Price Error:", e));
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Fetch Price Error:', error);
        return res.status(error.status || 500).json({ error: error.message || 'Failed to fetch subscription price' });
    }
});

// GET /api/v1/deliberation/stream
// SSEを用いて各専門家の議論推論をリアルタイムに送信する
router.get('/stream', async (req: Request, res: Response) => {
    try {
        await checkBudgetAndThrow();
    } catch (error: any) {
        return res.status(error.status || 500).json({ error: error.message || 'Budget exceeded' });
    }

    const sessionId = req.query.session_id as string;

    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(404).json({ error: 'Session not found' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const session = sessions.get(sessionId);
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`);

    const conversationHistory: string[] = [];
    let isClientClosed = false;

    req.on('close', () => {
        isClientClosed = true;
        console.log(`SSE connection closed for session: ${sessionId}`);
    });

    try {
        // フロントエンド上に「入室しました...」の待機演出を数秒間表示させるための初期ディレイ
        for (let i = 0; i < 3; i++) {
            if (isClientClosed) break;
            res.write(`data: ${JSON.stringify({ type: 'ping', message: 'keep-alive' })}\n\n`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // キャッシュ確認
        const cachedData = (session.experts && session.experts.length > 0 && session.futureAnalysis)
            ? { future: session.futureAnalysis, experts: session.experts }
            : undefined;

        // 統合ストリーム実行 (Phase 7)
        const streamText = await streamUnifiedDeliberation(
            session.target,
            session.category,
            session.price || null,
            session.user_context,
            (chunkText: string) => {
                if (isClientClosed) return;
                res.write(`data: ${JSON.stringify({
                    type: 'unified_chunk',
                    chunk_text: chunkText
                })}\n\n`);
            },
            cachedData
        );

        // --- サーバー側でのキャッシュ保存処理 (抽出) ---
        if (!cachedData && streamText) {
            let futureAnalysis = null;
            const futureMatch = streamText.match(/<future_value>([\s\S]*?)<\/future_value>/);
            if (futureMatch) {
                try { futureAnalysis = JSON.parse(futureMatch[1]); } catch (e) { }
            }

            let experts = null;
            const expertMatch = streamText.match(/<expert_generation>([\s\S]*?)<\/expert_generation>/);
            if (expertMatch) {
                try { experts = JSON.parse(expertMatch[1]); } catch (e) { }
            }

            if (futureAnalysis || experts) {
                console.log(`[Unified Stream] Saving cache for ${session.target}`);
                setCache(session.target, session.price || null, futureAnalysis, experts).catch(e => console.error(e));
            }
        }

        if (!isClientClosed) {
            res.write(`data: ${JSON.stringify({ type: 'final_verdict', message: 'Debate finished' })}\n\n`);
            res.end();
            sessions.delete(sessionId); // セッション終了
        }

    } catch (error: any) {
        console.error('Unified Stream Error:', error);
        if (!isClientClosed) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message || 'Stream processing failed' })}\n\n`);
            res.end();
        }
    }
});

export default router;

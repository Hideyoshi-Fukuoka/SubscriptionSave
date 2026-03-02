import { Router, Request, Response } from 'express';
import { generateExpertSelection, streamExpertDebate, fetchSubscriptionPrice, ExpertData } from '../services/gemini';
import { getCache, setCache } from '../services/cache';

const router = Router();

// 仮のインメモリセッションストア
const sessions = new Map<string, any>();

// POST /api/v1/deliberation/initiate
// ユーザーの入力をもとにOrchestratorが3名の専門家を選出し、セッションを確立する
router.post('/initiate', async (req: Request, res: Response) => {
    try {
        const { subscription_id, name, category, price, user_context } = req.body;

        // まずSupabaseキャッシュをチェックする
        const cache = await getCache(name);

        // Orchestratorによる専門家のメタ生成処理 (Gemini APIの実行)
        let selectedExperts: ExpertData[];

        if (cache && cache.experts && cache.experts.length > 0) {
            console.log(`Using cached experts for ${name}`);
            selectedExperts = cache.experts; // キャッシュから固定枠含め完全復元する想定だが、動的枠だけ復元する構成に変更する

            // キャッシュがある場合でも固定枠は再結合するため、キャッシュには「動的3名」のみを保存する運用とする
            const dynamicExperts = cache.experts.filter(e => !['節約主婦', '経営コンサルタント社長'].includes(e.role));
            selectedExperts = dynamicExperts;
        } else {
            // デバイスの環境変数に GEMINI_API_KEY がない場合を考慮し、フェイルセーフを設ける
            if (process.env.GEMINI_API_KEY) {
                console.log('Generating experts via Gemini API...');
                selectedExperts = await generateExpertSelection(name, category, user_context);

                // 動的に生成した3名をキャッシュに非同期で保存しておく (priceやfutureAnalysisは現状不明のためnull)
                // バックグラウンドで保存
                setCache(name, null, null, selectedExperts).catch(e => console.error("Cache Save Error:", e));
            } else {
                console.warn('GEMINI_API_KEY is not set. Using fallback mock experts.');
                selectedExperts = [
                    {
                        role: '重課金引退勢',
                        name: '影山',
                        perspective: 'サンクコストへの後悔と時間の喪失',
                        tone: '丁寧だが情動的',
                        logic_prompt: '過去の課金額を否定し、電子の海に消える虚しさを説くこと'
                    },
                    {
                        role: 'サブスク依存アナリスト',
                        name: '佐藤',
                        perspective: '複数契約の罠と利用頻度の乖離',
                        tone: '論理的で冷徹',
                        logic_prompt: '見たい時に1ヶ月だけ契約するというスポット利用の合理性を説くこと'
                    },
                    {
                        role: 'ミニマリスト',
                        name: 'シンプリスト・ケイ',
                        perspective: '所有しない生き方と執着の放棄',
                        tone: '悟りを開いたような静けさ',
                        logic_prompt: '使わないものに対する支払いは執着であると警告すること'
                    }
                ];
            }
        }

        // 固定枠の専門家（主婦、社長）を追加して計5名で議論させる
        const fixedExperts: ExpertData[] = [
            {
                role: '節約主婦',
                name: 'オカン',
                perspective: '家計のやりくりと無駄遣いへの怒り',
                tone: '関西弁のオカン風',
                logic_prompt: '1円の無駄も許さない主婦の目線で、日々の生活費と比較しながら厳しく叱責すること'
            },
            {
                role: '経営コンサルタント社長',
                name: 'CEO・剛田',
                perspective: '費用対効果(ROI)と時間価値のシビアな評価',
                tone: 'ビジネスライクで高圧的',
                logic_prompt: '投資対効果の観点から、そのサブスクが自身の成長や生産性向上に寄与していないなら即カットすべきと断言すること'
            }
        ];

        selectedExperts = [...selectedExperts, ...fixedExperts];

        const sessionId = `delib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const sessionData = {
            id: sessionId,
            target: name,
            category,
            experts: selectedExperts,
            status: 'initialized'
        };

        sessions.set(sessionId, sessionData);

        return res.status(200).json({
            session_id: sessionId,
            message: 'Session initiated successfully',
            expert_selection: selectedExperts
        });

    } catch (error) {
        console.error('Initiate Error:', error);
        return res.status(500).json({ error: 'Failed to initiate deliberation' });
    }
});

// GET /api/v1/deliberation/price
// Google Search Groundingを利用して、指定されたサブスクリプションの最新料金を取得する
router.get('/price', async (req: Request, res: Response) => {
    try {
        const name = req.query.name as string;
        if (!name) {
            return res.status(400).json({ error: 'Subscription name is required' });
        }

        const cache = await getCache(name);
        if (cache && cache.price !== null && cache.price !== undefined) {
            console.log(`Returning cached price for ${name}`);
            return res.status(200).json({ price: cache.price });
        }

        const price = await fetchSubscriptionPrice(name);

        if (price !== null) {
            // 他のキャッシュデータ（エキスパート等）を消さずに上書き保存するため、
            // API呼び出し直前に取得したcacheの状態を引き継ぐ
            setCache(name, price, cache?.future_analysis || null, cache?.experts || null)
                .catch(e => console.error("Cache Save Price Error:", e));
        }

        return res.status(200).json({ price });
    } catch (error) {
        console.error('Fetch Price Error:', error);
        return res.status(500).json({ error: 'Failed to fetch subscription price' });
    }
});

// GET /api/v1/deliberation/stream
// SSEを用いて各専門家の議論推論をリアルタイムに送信する
router.get('/stream', async (req: Request, res: Response) => {
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
        const TURN_COUNT = 2; // 一人2回発言（計10発言）の本格ディベート

        // ターン制でディベートを進行する
        for (let turn = 1; turn <= TURN_COUNT; turn++) {
            for (const expert of session.experts as ExpertData[]) {
                if (isClientClosed) break;

                let expertFullText = "";

                // フロント側で「新しい発言バブルを作る」キックオフイベントを送信
                res.write(`data: ${JSON.stringify({
                    type: 'agent_start',
                    role: expert.role,
                    turn: turn
                })}\n\n`);

                // Geminiストリーミングを呼び出し、チャンクが届くたびにSSEで送出
                const debateResult = await streamExpertDebate(
                    session.target,
                    expert,
                    conversationHistory,
                    (chunkText: string) => {
                        if (isClientClosed) return;
                        res.write(`data: ${JSON.stringify({
                            type: 'agent_chunk',
                            role: expert.role,
                            chunk_text: chunkText
                        })}\n\n`);
                    },
                    (score: number) => {
                        if (isClientClosed) return;
                        res.write(`data: ${JSON.stringify({
                            type: 'agent_score',
                            role: expert.role,
                            score: score
                        })}\n\n`);
                    }
                );

                expertFullText = debateResult.content;
                const expertScore = debateResult.score;

                // 次のエージェントへ渡すため、発言内容を履歴に保存
                conversationHistory.push(`【${expert.role}（${expert.name}）の意見 (ターン${turn})】\n解約推奨度スコア: ${expertScore}/100\n理由: ${expertFullText}`);

                // 擬似的な思考時間（ターン間のインターバル）
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }

        if (!isClientClosed) {
            // Orchestratorが履歴全てを見て、最終的な解約推奨度を出す（現在は固定モックだが、将来動的化可能）
            res.write(`data: ${JSON.stringify({
                type: 'final_verdict',
                final_verdict: 'REJECT',
                score: 85,
                visualization: {
                    jerky_count: 5.5,
                    gacha_pulls: 12
                }
            })}\n\n`);

            res.end();
            sessions.delete(sessionId); // セッション終了
        }

    } catch (error) {
        console.error('Deliberation streaming error:', error);
        if (!isClientClosed) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: '議論中にエラーが発生しました。' })}\n\n`);
            res.end();
        }
    }
});

export default router;

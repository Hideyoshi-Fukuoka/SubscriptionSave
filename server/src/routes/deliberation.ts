import { Router, Request, Response } from 'express';
import { generateExpertSelection, ExpertData } from '../services/gemini';

const router = Router();

// 仮のインメモリセッションストア
const sessions = new Map<string, any>();

// POST /api/v1/deliberation/initiate
// ユーザーの入力をもとにOrchestratorが3名の専門家を選出し、セッションを確立する
router.post('/initiate', async (req: Request, res: Response) => {
    try {
        const { subscription_id, name, category, price, user_context } = req.body;

        // Orchestratorによる専門家のメタ生成処理 (Gemini APIの実行)
        // デバイスの環境変数に GEMINI_API_KEY がない場合を考慮し、フェイルセーフを設ける
        let selectedExperts: ExpertData[];
        if (process.env.GEMINI_API_KEY) {
            console.log('Generating experts via Gemini API...');
            selectedExperts = await generateExpertSelection(name, category, user_context);
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

// GET /api/v1/deliberation/stream
// SSEを用いて各専門家の議論推論をリアルタイムに送信する
router.get('/stream', (req: Request, res: Response) => {
    const sessionId = req.query.session_id as string;

    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(404).json({ error: 'Session not found' });
    }

    // SSEヘッダーの設定
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const session = sessions.get(sessionId);

    // クライアント接続開始を通知
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`);

    // --- ここからモックのリアルタイムチャンク送信シミュレート ---
    let tick = 0;
    const interval = setInterval(() => {
        tick++;

        // ランダムな専門家発言のチャンク送信
        const expertIndex = tick % session.experts.length;
        const expert = session.experts[expertIndex];

        res.write(`data: ${JSON.stringify({
            type: 'agent_chunk',
            role: expert.role,
            chunk_text: `[${tick}番目の発言チャンク] ${expert.name}が推論中... `
        })}\n\n`);

        // 約10回のストリーミング送信でモックを打ち切る
        if (tick >= 10) {
            clearInterval(interval);

            // 最終審議結果の送信
            res.write(`data: ${JSON.stringify({
                type: 'final_verdict',
                final_verdict: 'REJECT',
                score: 85,
                visualization: {
                    jerky_count: 1.5,
                    gacha_pulls: 6
                }
            })}\n\n`);

            res.end(); // 接続終了
        }
    }, 1500); // 1.5秒ごとにチャンクを流す

    // クライアントからの切断を検知
    req.on('close', () => {
        clearInterval(interval);
        console.log(`SSE connection closed for session: ${sessionId}`);
    });
});

export default router;

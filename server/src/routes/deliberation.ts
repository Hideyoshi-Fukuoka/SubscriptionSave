import { Router, Request, Response } from 'express';
import { generateExpertSelection, streamExpertDebate, ExpertData } from '../services/gemini';

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
        // 各専門家（エージェント）ごとにターン制でディベートを進行する
        for (const expert of session.experts as ExpertData[]) {
            if (isClientClosed) break;

            let expertFullText = "";

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
                }
            );

            expertFullText = debateResult;

            // 次のエージェントへ渡すため、発言内容を履歴に保存
            conversationHistory.push(`【${expert.role}（${expert.name}）の意見】\n${expertFullText}`);

            // 擬似的な思考時間（ターン間のインターバル）
            await new Promise(resolve => setTimeout(resolve, 1000));
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

import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { recordUsage } from './billing';
dotenv.config();

// 環境変数 GEMINI_API_KEY が存在することを前提とします。
// 取得できない場合はモックを使用するフォールバック等も適宜検討します。
const ai = new GoogleGenAI({});

export interface ExpertData {
    role: string;
    name: string;
    perspective: string;
    tone: string;
    logic_prompt: string;
}

export const generateExpertSelection = async (
    sub_name: string,
    category: string,
    user_context: any
): Promise<ExpertData[]> => {
    const prompt = `
# Role: 専門家選定オーケストレーター
あなたは「サブスク断捨離の守護神」の頭脳であり、対象のサブスクリプションを解体・審議するために最適な3名の専門家をアサインする「召喚師」です。

# Input Data
- サブスク名: ${sub_name}
- カテゴリ: ${category}
- ユーザーの悩み/状況: ${JSON.stringify(user_context)}

# Task
入力された情報を分析し、以下の「専門家選定アルゴリズム」に従って、議論を最も活性化（デフラグ）させる3名の専門家を動的に生成してください。

## 専門家選定アルゴリズム
1. **カテゴリー特化枠 (1名)**: そのサービスの機能的価値を冷徹に評価できる専門家。
2. **心理・習慣分析枠 (1名)**: ユーザーの「執着」や「惰性」を心理学・行動経済学的に指摘できる専門家。
3. **情動・経験枠 (1名)**: その道で「失敗」や「極致」を経験し、ユーザーに寄り添いつつも厳しい現実を突きつける者。
   ※対象がゲームの場合、この枠は必ず【重課金引退勢（丁寧語、後悔の知恵者）】をアサインせよ。
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        expert_selection: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    role: { type: Type.STRING, description: "役割名" },
                                    name: { type: Type.STRING, description: "二つ名" },
                                    perspective: { type: Type.STRING, description: "評価軸" },
                                    tone: { type: Type.STRING, description: "話し方の特徴" },
                                    logic_prompt: { type: Type.STRING, description: "エージェントを動かすシステムプロンプトの核" }
                                },
                                required: ["role", "name", "perspective", "tone", "logic_prompt"]
                            }
                        }
                    },
                    required: ["expert_selection"]
                }
            }
        });

        const resultText = response.text;
        if (!resultText) throw new Error("No response from Gemini API");

        // 日本語を含むAPI利用のため、簡易的に「(入力+出力文字数)/2」をトークン数として算出して記録する
        const estimatedTokens = Math.ceil((prompt.length + resultText.length) / 2);
        recordUsage(estimatedTokens).catch(e => console.error(e));

        const parsed = JSON.parse(resultText);
        return parsed.expert_selection;
    } catch (error) {
        console.error('Gemini API Error:', error);
        throw error;
    }
};

export const streamExpertDebate = async (
    sub_name: string,
    price: number | null,
    future_analysis: FutureValueAnalysis | null,
    expert: ExpertData,
    conversationHistory: string[],
    onChunk: (text: string) => void,
    onScoreMatch?: (score: number) => void
) => {
    // これまでの議論の文脈を組み立てる
    const historyText = conversationHistory.length > 0
        ? `【これまでの議論】\n${conversationHistory.join('\n\n')}\n\n上記を踏まえ、あなたの意見と、必要であれば前の意見への反論を述べてください。`
        : `あなたは最初の発言者です。対象のサービスについて客観的・分析的に問題提起を行ってください。`;

    const isGamerRetiree = expert.role.includes('引退勢');
    const gamerRetireeInjection = isGamerRetiree && future_analysis && future_analysis.upcoming_contents.length > 0 ? `
【特別な指示（SNS感情・センチメント注入）】
あなたは「重課金引退勢」です。上記の「客観的エビデンス（近日配信予定）」の内容を逆手に取り、ユーザーの期待をへし折り激しく煽ってください。
「『${future_analysis.upcoming_contents[0]}』が来るから待機？ 目を覚ませよ。俺も昔はそうやって周年や大型アプデの虚無期間に金を払い続けて、結局イベントが来てもインフレ集金カーニバルに絶望したんだ」などと、SNS上の不満や過去の炎上の空気感に近い「経験者の諦め」を滲ませ、今すぐ解約すべきだと強く主張してください。
` : '';

    const prompt = `
# Role
あなたは「${expert.name}（${expert.role}）」です。
- 評価軸: ${expert.perspective}
- 口調の特徴: ${expert.tone}
- 思考の核: ${expert.logic_prompt}

# Target
対象サブスクリプション: ${sub_name}
${price !== null ? `現在の月額料金: ${price}円` : ''}
${future_analysis && future_analysis.upcoming_contents.length > 0 ? `
【客観的エビデンス（未来価値アナリティクス）】
・今後3〜6ヶ月の目玉コンテンツ・アップデート予定:
  ${future_analysis.upcoming_contents.map(c => `- ${c}`).join('\n  ')}
・未来価値プレイスコア: ${future_analysis.future_score} / 10
・総評: ${future_analysis.summary}
` : ''}

# Instruction
${historyText}
${gamerRetireeInjection}

必ず「${expert.tone}」の口調を守り、的確な分析や反論を生成してください。
さらに、あなた自身の現時点での「解約推奨度スコア（0〜100、100が即解約推奨）」を算出してください。

【超重要：出力フォーマット】
必ず1行目にスコアの「数値のみ」を出力し、改行して2行目から発言の本文を開始してください。装飾やマークダウン、Score: などの文字は一切書かないでください。

例:
85
このサブスクは惰性で続けているだけです。今すぐ解約すべきですね。
`;

    try {
        console.log(`[Debate Stream] Starting for expert: ${expert.name} (${expert.role})`);
        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: prompt
        });

        let fullText = "";
        let reportedScore = false;

        for await (const chunk of responseStream) {
            const chunkText = chunk.text;
            if (chunkText) {
                fullText += chunkText;

                // スコア抽出
                if (!reportedScore) {
                    // 最初の改行が現れるまでの間に含まれる数値をスコアとみなす（先頭縛りを緩和）
                    const firstNewlineIndex = fullText.indexOf('\n');

                    if (firstNewlineIndex !== -1) {
                        const firstLine = fullText.substring(0, firstNewlineIndex);
                        const scoreMatch = firstLine.match(/(\d{1,3})/);

                        if (scoreMatch) {
                            console.log(`[Debate Stream] Score extracted for ${expert.name}:`, parseInt(scoreMatch[1], 10));
                            if (onScoreMatch) onScoreMatch(parseInt(scoreMatch[1], 10));
                            reportedScore = true;
                            // スコアが含まれていた行より後のテキストから送信開始
                            const remainingText = fullText.substring(firstNewlineIndex + 1);
                            if (remainingText.length > 0) {
                                onChunk(remainingText);
                            }
                        } else {
                            // 最初の行に数値が全くなかった場合（AIが指示を無視したケース）
                            // 仕方がないのでデフォルトスコア50とし、全文をテキストとして送信開始
                            console.log(`[Debate Stream] Warning: No score found in first line for ${expert.name}, defaulting to 50.`);
                            if (onScoreMatch) onScoreMatch(50);
                            reportedScore = true;
                            onChunk(fullText);
                        }
                    } else if (fullText.length > 30) {
                        // 30文字を超えても改行が来ない場合は、改行なしで喋り出していると判定
                        const scoreMatch = fullText.match(/^(\d{1,3})/);
                        if (scoreMatch) {
                            console.log(`[Debate Stream] Score extracted (no early newline) for ${expert.name}:`, parseInt(scoreMatch[1], 10));
                            if (onScoreMatch) onScoreMatch(parseInt(scoreMatch[1], 10));
                            reportedScore = true;
                            const remainingText = fullText.substring(scoreMatch[0].length);
                            onChunk(remainingText);
                        } else {
                            console.log(`[Debate Stream] Warning: No score found (no newline) for ${expert.name}, defaulting to 50.`);
                            if (onScoreMatch) onScoreMatch(50);
                            reportedScore = true;
                            onChunk(fullText);
                        }
                    }
                } else {
                    // スコア特定後は残りのチャンクをそのままフロントへ投げ続ける
                    onChunk(chunkText);
                }
            }
        }

        // 最終的なテキストを返すための再パース
        let finalScore = 50;
        let finalContent = fullText.trim();

        const firstNewlineIndexEnd = fullText.indexOf('\n');
        if (firstNewlineIndexEnd !== -1) {
            const firstLineEnd = fullText.substring(0, firstNewlineIndexEnd);
            const scoreMatchEnd = firstLineEnd.match(/(\d{1,3})/);
            if (scoreMatchEnd) {
                finalScore = parseInt(scoreMatchEnd[1], 10);
                finalContent = fullText.substring(firstNewlineIndexEnd + 1).trim();
            }
        } else {
            const scoreMatchEndFallback = fullText.match(/^(\d{1,3})/);
            if (scoreMatchEndFallback) {
                finalScore = parseInt(scoreMatchEndFallback[1], 10);
                finalContent = fullText.substring(scoreMatchEndFallback[0].length).trim();
            }
        }

        console.log(`[Debate Stream] Finished for: ${expert.name}. Final score: ${finalScore}, Length: ${finalContent.length}`);

        // ストリーミング終了時に総トークンを概算して記録する
        const estimatedTokens = Math.ceil((prompt.length + fullText.length) / 2);
        recordUsage(estimatedTokens).catch(e => console.error(e));

        return {
            content: finalContent,
            score: finalScore
        };

    } catch (error) {
        console.error(`Gemini Stream Error (${expert.name}):`, error);
        throw error;
    }
};

export const fetchSubscriptionPrice = async (sub_name: string): Promise<{ price: number, formal_name: string } | null> => {
    const prompt = `
# Task
あなたは優秀なリサーチャーです。対象のサブスクリプションサービスの【日本国内における最新の標準的な月額料金（円）】を、ウェブ検索を用いて特定してください。
また、対象「${sub_name}」が略称や俗称（例: dq10, ネトフリ, アマプラ）の場合、正式名称（例: ドラゴンクエストX, Netflix, Amazon Prime）を文脈や検索結果から推測してください。明確に正式名である場合はそのまま使用してください。

# Target
対象: ${sub_name}

# Output format
必ず以下のJSON形式のみを出力してください。装飾文字や説明文は一切不要です。
もし無料サービスであったり、特定が困難な場合は price を 0 としてください。
{
    "formal_name": "推測した正式名称",
    "price": 1500
}
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }], // Google Search Groundingを有効化
            }
        });

        const resultText = response.text?.trim();
        if (!resultText) return null;

        // Grounding検索を含むため若干トークン増だが、ベースとして文字数から概算記録
        const estimatedTokens = Math.ceil((prompt.length + resultText.length) / 2);
        recordUsage(estimatedTokens).catch(e => console.error(e));

        try {
            const match = resultText.match(/\{[\s\S]*\}/);
            const jsonText = match ? match[0] : resultText;
            const parsed = JSON.parse(jsonText);

            return {
                formal_name: parsed.formal_name || sub_name,
                price: typeof parsed.price === 'number' ? parsed.price : parseInt(String(parsed.price).replace(/,/g, ''), 10) || 0
            };
        } catch (e) {
            console.error("Price JSON parse error:", e, "Raw text:", resultText);
            return null;
        }

    } catch (error) {
        console.error('Gemini Price Fetch Error:', error);
        return null; // エラー時は処理を止めずnullを返し、フロントのフォールバックに任せる
    }
};

export interface FutureValueAnalysis {
    upcoming_contents: string[];
    future_score: number; // 0〜10の熱狂度・期待度
    summary: string;
}

/**
 * Google Search Groundingを利用して、
 * 対象サブスクリプションの近日中の注目コンテンツや今後の熱狂度（未来価値）を算出して返す
 */
export const fetchSubscriptionFutureValue = async (sub_name: string): Promise<FutureValueAnalysis | null> => {
    const prompt = `
# Task
あなたは情報収集と要約の達人です。Google検索機能を用いて、「${sub_name}」に関する**近日中（むこう3〜6ヶ月以内）の強力な配信予定や目玉コンテンツ、または大型アップデート情報**を検索し、分析してください。

# Instructions
1. 対象サブスクの価値を引き上げる強力なコンテンツ（独占配信、大型IP、続編など）やニュースがあれば、最大3つまで簡潔にリストアップしてください。
2. それらのラインナップから総合的に見て、今後継続すべき「未来価値のプレイスコア」を0（全く価値なし・目玉ゼロ）から10（絶対に解約してはいけないレベルの熱狂）で診断してください。
3. 全体の簡潔な要約コメントを作成してください。

必ず以下のJSON形式のみを出力してください。マークダウン等の装飾は不要です。
{
    "upcoming_contents": ["コンテンツ1", "コンテンツ2"],
    "future_score": 8,
    "summary": "要約コメント"
}
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }]
            }
        });

        const resultText = response.text;
        if (!resultText) return null;

        // Grounding検索を含むためトークン消費を概算して記録
        const estimatedTokens = Math.ceil((prompt.length + resultText.length) / 2);
        recordUsage(estimatedTokens).catch(e => console.error(e));

        try {
            // "```json ... ```" のような装飾が含まれる場合があるため、最初の "{" から最後の "}" までを抽出
            const match = resultText.match(/\{[\s\S]*\}/);
            const jsonText = match ? match[0] : resultText;
            const parsed = JSON.parse(jsonText);

            return {
                upcoming_contents: parsed.upcoming_contents || [],
                future_score: parsed.future_score || 5,
                summary: parsed.summary || "解析結果なし"
            };
        } catch (parseError) {
            console.error("Gemini Future Value Parse Error:", parseError, "Raw Text:", resultText);
            return null;
        }
    } catch (error) {
        console.error('Gemini Future Value Analysis Error:', error);
        return null;
    }
};

/**
 * プロンプト統合版：未来価値算出、専門家生成、5ターンの議論を1回のストリーミングで行う
 */
export const streamUnifiedDeliberation = async (
    sub_name: string,
    category: string,
    price: number | null,
    user_context: any,
    onChunk: (text: string) => void,
    cachedData?: { future: any, experts: any }
) => {
    const isCached = cachedData && cachedData.experts && cachedData.experts.length > 0;
    const currentDate = new Date().toLocaleDateString('ja-JP');

    const basePrompt = `
# Role: サブスク断捨離の守護神 (統合オーケストレーター)
対象のサブスクリプションについて、未来価値の分析、専門家の選定、そして5名による解約を巡る白熱した議論をすべて一気に実行してください。

# System Context
- 現在の日本時間は 【${currentDate}】 です。これより先のアップデート予定などはこの基準日から正確に計算してください。

# Input Data
- サブスク名: ${sub_name}
- カテゴリ: ${category}
- 料金: ${price !== null ? price + '円/月' : '不明（または無料）'}
- ユーザーの悩み/状況: ${JSON.stringify(user_context)}
`;

    let stepInstructions = "";

    const debateRules = `
## Step 3: 5名によるターン制議論 (<debate_turn>タグ)
さきほどの3名（キャッシュ時はリストの3名）と、固定の「主婦」「CEO」を加えた【計5名】で、解約すべきか激しく議論させてください。
固定専門家1: role="節約の鬼", name="無慈悲な主婦", perspective="1円の無駄も許さない絶対的コストカット"
固定専門家2: role="タイムイズマネー", name="冷徹なCEO", perspective="費用対効果(ROI)と時間価値のシビアな評価"

【議論の厳格なルール】
1. **短く鋭く**: 各発言は必ず【150文字以内で、短文で完結】させてください。長広舌はテンポを損なうため厳禁です。
2. **ターン制の役割**: 5ターン（1人1回）で以下のステップを踏み、同じ論点を繰り返さず深みのある議論を展開してください。
   - ターン1 (分析担当): 未来価値データの事実を突きつけ、最初の厳しい宣告をする
   - ターン2 (反論担当): 別の視点（過去の思い出や可能性）から「いや、それでも価値がある」と反論する
   - ターン3 (情動/経験担当): 過去の経験（引退勢の絶望等）などを織り交ぜ、ターン2を冷たく論破する
   - ターン4 (CEOまたは主婦): お金や時間（ROI）の絶対的な数字を根拠に、完全にトドメを刺す宣告をする
   - ターン5 (総括担当): 最後に、ユーザーへ感情に訴えかける一言で結論を締める

出力形式:
<debate_turn role="役割名" name="キャラクター名" score="85">
ここに発言内容を出力してください（150文字以内）。
</debate_turn>
※ score属性は「解約推奨度スコア」(0=絶対継続、100=今すぐ解約) を入れてください。
`;

    if (isCached) {
        stepInstructions = `
すでに過去の分析によって、以下のデータが確定しています。
【未来価値データ】 ${JSON.stringify(cachedData.future)}
【専門家リスト】 ${JSON.stringify(cachedData.experts)}

# Task
あなたはStep1(未来価値分析)とStep2(専門家生成)を行う必要はありません。直ちに以下の【専門家リスト】と固定2名で議論を開始してください。
${debateRules}
出力は余計な前置きをせず、直ちに最初の <debate_turn> タグから開始してください。
`;
    } else {
        stepInstructions = `
# Task
以下の順番で必ず「XMLライクなタグ」を用いて出力してください。テキストは生成された端からストリーミングされます。

## Step 1: 未来価値分析 (<future_value>タグ)
Google検索機能を用いて、「${sub_name}」に関する近日中（現在の ${currentDate} からむこう3〜6ヶ月以内）の強力な配信予定や目玉コンテンツを検索・分析してください。
出力形式 (必ず内部はJSON構造にすること):
<future_value>
{
    "upcoming_contents": ["目玉コンテンツ1", "目玉コンテンツ2"],
    "future_score": 8,
    "summary": "要約コメント"
}
</future_value>
※ future_scoreは0〜10の整数。

## Step 2: 専門家の動的生成 (<expert_generation>タグ)
対象サブスクに特化した専用の専門家を【3名】生成してください。※対象がゲーム等の場合は1名を「重課金引退勢」等にしてください。
出力形式 (必ず内部はJSON配列構造にすること):
<expert_generation>
[
    {
        "role": "役割名",
        "name": "二つ名",
        "perspective": "評価軸",
        "tone": "話し方の特徴",
        "logic_prompt": "短めの主張の核"
    }
]
</expert_generation>

${debateRules}
出力は余計な前置きを一切せず、直ちに <future_value> から開始してください。
`;
    }

    const prompt = basePrompt + stepInstructions;

    try {
        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: isCached ? [] : [{ googleSearch: {} }], // キャッシュ時はGrounding不要
            }
        });

        let fullText = "";
        for await (const chunk of responseStream) {
            const chunkText = chunk.text;
            if (chunkText) {
                fullText += chunkText;
                onChunk(chunkText);
            }
        }

        const estimatedTokens = Math.ceil((prompt.length + fullText.length) / 2);
        recordUsage(estimatedTokens).catch(e => console.error(e));

        return fullText;

    } catch (error) {
        console.error('Gemini Unified Stream Error:', error);
        throw error;
    }
};

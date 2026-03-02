import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
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
    expert: ExpertData,
    conversationHistory: string[],
    onChunk: (text: string) => void,
    onScoreMatch?: (score: number) => void
) => {
    // これまでの議論の文脈を組み立てる
    const historyText = conversationHistory.length > 0
        ? `【これまでの議論】\n${conversationHistory.join('\n\n')}\n\n上記を踏まえ、あなたの意見と、必要であれば前の意見への反論を述べてください。`
        : `あなたは最初の発言者です。対象のサービスについて客観的・分析的に問題提起を行ってください。`;

    const prompt = `
# Role
あなたは「${expert.name}（${expert.role}）」です。
- 評価軸: ${expert.perspective}
- 口調の特徴: ${expert.tone}
- 思考の核: ${expert.logic_prompt}

# Target
対象サブスクリプション: ${sub_name}
${price !== null ? `現在の月額料金: ${price}円` : ''}

# Instruction
${historyText}

必ず「${expert.tone}」の口調を守り、的確な分析や反論を生成してください。
さらに、あなた自身の現時点での「解約推奨度スコア（0〜100、100が即解約推奨）」を算出してください。

【超重要：出力フォーマット】
必ず1行目にスコアの「数値のみ」を出力し、改行して2行目から発言の本文を開始してください。装飾やマークダウン、Score: などの文字は一切書かないでください。

例:
85
このサブスクは惰性で続けているだけです。今すぐ解約すべきですね。
`;

    try {
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
                    const scoreMatch = fullText.match(/^\s*(\d{1,3})\s*\n/);
                    if (scoreMatch) {
                        if (onScoreMatch) onScoreMatch(parseInt(scoreMatch[1], 10));
                        reportedScore = true;

                        // 初回送信
                        const textPart = fullText.substring(scoreMatch[0].length);
                        if (textPart.length > 0) {
                            onChunk(textPart);
                        }
                    } else if (fullText.length > 20 && !fullText.includes('\n')) {
                        // AIが「改行せずにスコアを書いた」等のフェイルセーフ（20文字見ても改行がない場合は諦める）
                        if (onScoreMatch) onScoreMatch(50);
                        reportedScore = true;
                        onChunk(fullText);
                    }
                } else {
                    // スコア特定後は残りのチャンクをそのままフロントへ投げ続ける
                    onChunk(chunkText);
                }
            }
        }

        // 最終的なテキストを返す
        const scoreMatch = fullText.match(/^\s*(\d{1,3})\s*\n/);
        let finalScore = 50;
        let finalContent = fullText.trim();

        if (scoreMatch) {
            finalScore = parseInt(scoreMatch[1], 10);
            finalContent = fullText.substring(scoreMatch[0].length).trim();
        }

        return {
            content: finalContent,
            score: finalScore
        };

    } catch (error) {
        console.error(`Gemini Stream Error (${expert.name}):`, error);
        throw error;
    }
};

export const fetchSubscriptionPrice = async (sub_name: string): Promise<number | null> => {
    const prompt = `
# Task
あなたは優秀なリサーチャーです。対象のサブスクリプションサービスの【日本国内における最新の標準的な月額料金（円）】を、ウェブ検索を用いて特定してください。

# Target
対象サブスクリプション: ${sub_name}

# Output format
出力は絶対に「数値（整数）のみ」としてください。カンマ、円、説明文などの装飾は一切不要です。（例: 1500）
もし無料サービスであったり、月額サービスでない等で特定が困難な場合は、「0」を出力してください。
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

        // 文字列から「連続する数値（カンマ含む）」を抽出する
        // 例: "約1,490円" や "Netflixは1,500円です" から "1,490", "1,500" を取り出す
        const match = resultText.match(/\d+(?:,\d+)?/);
        if (!match) return null;

        const price = parseInt(match[0].replace(/,/g, ''), 10);
        return isNaN(price) ? null : price;

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
 * スクレイピングにより取得したテキスト群を元に、
 * 近日中の注目コンテンツや今後の熱狂度（未来価値）を算出して返す
 */
export const analyzeFutureValueContent = async (sub_name: string, scraped_text: string): Promise<FutureValueAnalysis | null> => {
    // スクレイピングテキストが長すぎる場合は、先頭5000文字程度で打ち切る（トークン節約＆ノイズ削減）
    const truncatedText = scraped_text.substring(0, 5000);

    const prompt = `
# Task
あなたは情報要約の達人です。提供されたウェブページのテキスト群を読み解き、「${sub_name}」に関する**近日中（むこう3〜6ヶ月以内）の強力な配信予定や目玉コンテンツ**が存在するかを分析してください。

# Input Data
\`\`\`
${truncatedText}
\`\`\`

# Instructions
1. 対象サブスクの価値を引き上げる強力なコンテンツ（独占配信、大型IP、続編など）やニュースがあれば、最大3つまで簡潔にリストアップしてください。
2. それらのラインナップから総合的に見て、今後継続すべき「未来価値のスコア」を0（全く価値なし・目玉ゼロ）から10（絶対に解約してはいけないレベルの熱狂）で診断してください。
3. 全体の簡潔な要約コメントを作成してください。
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
                        upcoming_contents: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "目玉となる配信予定やコンテンツ。見つからなければ空配列。"
                        },
                        future_score: { type: Type.NUMBER, description: "未来価値のプレイスコア(0〜10の整数)" },
                        summary: { type: Type.STRING, description: "全体の要約と、継続すべきかの見解コメント" }
                    },
                    required: ["upcoming_contents", "future_score", "summary"]
                }
            }
        });

        const resultText = response.text;
        if (!resultText) return null;

        return JSON.parse(resultText) as FutureValueAnalysis;
    } catch (error) {
        console.error('Gemini Future Analysis Error:', error);
        return null;
    }
};

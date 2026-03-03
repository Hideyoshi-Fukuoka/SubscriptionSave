export interface ExpertSelection {
    role: string;
    name: string;
    perspective: string;
    tone: string;
    logic_prompt: string;
    // フロント表示用のフィールド群
    comment?: string;
    avatar?: string;
}

export interface DeliberationSession {
    session_id: string;
    message: string;
    expert_selection: ExpertSelection[];
    future_analysis?: any;
}

// 環境変数からAPI URLを取得（Viteの場合は import.meta.env を使用）
// 本番デプロイ（Vercel連携時など）は VITE_API_URL にRailwayのURLを設定する
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

/**
 * 守護神（Orchestrator）へサブスク情報を送信し、専門家を召喚（セッション確立）する
 */
export const initiateDeliberation = async (
    subName: string,
    price: number | null,
    category: string = 'unknown',
    userContext: any = {}
): Promise<DeliberationSession> => {
    try {
        const response = await fetch(`${API_BASE_URL}/deliberation/initiate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                subscription_id: `sub_${Date.now()}`,
                name: subName,
                price: price,
                category,
                user_context: userContext
            }),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => null);
            throw new Error(errData?.error || `API error: ${response.status}`);
        }

        return await response.json() as DeliberationSession;
    } catch (error) {
        console.error('Failed to initiate deliberation:', error);
        throw error;
    }
};

/**
 * 確立したセッションに対してSSEストリーム接続を開始し、チャンクを受け取る
 * @param sessionId initiateDeliberation で取得したセッションID
 * @param onMessage サーバーからのチャンクメッセージを受け取るコールバック
 * @param onError エラーや切断時のコールバック
 */
export const subscribeToDeliberationStream = (
    sessionId: string,
    onMessage: (data: any) => void,
    onError?: (err: Event) => void
): EventSource => {
    const sseUrl = `${API_BASE_URL}/deliberation/stream?session_id=${sessionId}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            onMessage(data);
        } catch (err) {
            console.error('Failed to parse SSE data:', err);
        }
    };

    eventSource.onerror = (err) => {
        console.error('SSE connection error:', err);
        eventSource.close();
        if (onError) onError(err);
    };

    return eventSource;
};

/**
 * 外部検索を利用して対象サブスクリプションの最新料金（日本国内）を取得する
 */
export const fetchSubscriptionPrice = async (subName: string): Promise<{ price: number, formal_name?: string } | null> => {
    try {
        const response = await fetch(`${API_BASE_URL}/deliberation/price?name=${encodeURIComponent(subName)}`);

        if (!response.ok) {
            const errData = await response.json().catch(() => null);
            throw new Error(errData?.error || `API error: ${response.status}`);
        }

        const data = await response.json();
        return {
            price: data.price,
            formal_name: data.formal_name
        };
    } catch (error) {
        console.error('Failed to fetch subscription price:', error);
        return null; // エラー時はnullを返し、フロントのデフォルトフローにフォールバックさせる
    }
};

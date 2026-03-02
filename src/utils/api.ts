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
}

const API_BASE_URL = 'http://localhost:4000/api/v1';

/**
 * 守護神（Orchestrator）へサブスク情報を送信し、専門家を召喚（セッション確立）する
 */
export const initiateDeliberation = async (
    subName: string,
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
                category,
                user_context: userContext
            }),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
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

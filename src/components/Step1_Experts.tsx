import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Users, AlertTriangle } from 'lucide-react';
import './Step1_Experts.css';

interface Step1Props {
    subName: string;
    price: number | null;
    onNext: (futureAnalysis?: any, wasteExamples?: any[]) => void;
}

import type { ExpertSelection } from '../utils/api';
import { initiateDeliberation, subscribeToDeliberationStream } from '../utils/api';

// UI描画用にセッション中の状態を保持する拡張型
interface ActiveExpert extends ExpertSelection {
    avatar: string; // クライアント側でアイコン(絵文字等)を補完する
}

interface ChatMessage {
    id: string;
    role: string;
    text: string;
    score?: number;
    isFinished: boolean;
}

export const Step1_Experts: React.FC<Step1Props> = ({ subName, price, onNext }) => {
    const [showDebate, setShowDebate] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('Orchestratorが最適な専門家を召喚中...');

    // セッションとSSEの参照
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [experts, setExperts] = useState<ActiveExpert[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    // 全員の議論が終わったか
    const [debateFinished, setDebateFinished] = useState(false);
    const [futureAnalysisData, setFutureAnalysisData] = useState<any>(null);
    const [wasteExamples, setWasteExamples] = useState<any[]>([]);

    // 専門家ごとのアイコンを適当に割り当てるヘルパー
    const getAvatarForRole = (role: string) => {
        if (role.includes('引退')) return '🥀';
        if (role.includes('社長') || role.includes('コンサル')) return '💼';
        if (role.includes('主婦') || role.includes('ミニマリスト')) return '🌿';
        if (role.includes('ゲーム') || role.includes('スポーツ')) return '🎮';
        if (role.includes('映画') || role.includes('映像')) return '🎬';
        if (role.includes('ガチ勢') || role.includes('ファン') || role.includes('信者')) return '🔥';
        return '👤';
    };

    useEffect(() => {
        let isMounted = true;

        const setupDeliberation = async () => {
            try {
                // 1. Session Initiate (Orchestratorによる動的アサイン または キャッシュ復元)
                const sessionData = await initiateDeliberation(subName, price);
                if (!isMounted) return;

                setSessionId(sessionData.session_id);

                // キャッシュがある場合はここで初期セットされる（ない場合は空配列）
                if (sessionData.expert_selection && sessionData.expert_selection.length > 0) {
                    const initialExperts = sessionData.expert_selection.map((ex: any) => ({
                        ...ex,
                        avatar: getAvatarForRole(ex.role)
                    }));

                    const fixedExperts = [
                        { role: '節約主婦', name: 'オカン', perspective: '家計のやりくりと無駄遣いへの怒り', tone: '関西弁のオカン風', logic_prompt: '', avatar: getAvatarForRole('節約主婦') },
                        { role: '経営コンサルタント社長', name: 'CEO・剛田', perspective: '費用対効果(ROI)と時間価値のシビアな評価', tone: 'ビジネスライクで高圧的', logic_prompt: '', avatar: getAvatarForRole('経営コンサルタント社長') }
                    ];
                    setExperts([...initialExperts, ...fixedExperts]);
                } else {
                    setExperts([]);
                }

                if (sessionData.future_analysis) {
                    setFutureAnalysisData(sessionData.future_analysis);
                }

                if (sessionData.waste_examples) {
                    setWasteExamples(sessionData.waste_examples);
                }

                setLoadingMsg('');

            } catch (err: any) {
                console.error("Initiation Failed", err);
                if (isMounted) {
                    if (err.message && err.message.includes('予算')) {
                        setLoadingMsg(`【システムエラー】: \n${err.message}`);
                    } else {
                        setLoadingMsg('専門家の召喚に失敗しました。再試行してください。');
                    }
                }
            }
        };

        setupDeliberation();

        return () => { isMounted = false; };
    }, [subName]);

    // 議論開始ボタンが押されたら、SSE通信を開始する
    useEffect(() => {
        if (!showDebate || !sessionId) return;

        let localUnifiedText = "";

        const sse = subscribeToDeliberationStream(sessionId, (data) => {
            if (data.type === 'connected') {
                console.log('SSE Connected');
            } else if (data.type === 'unified_chunk') {
                localUnifiedText += data.chunk_text;

                // 1. 未来価値の抽出 (<future_value> タグ)
                const futureMatch = localUnifiedText.match(/<future_value>([\s\S]*?)<\/future_value>/);
                if (futureMatch) {
                    try {
                        const parsed = JSON.parse(futureMatch[1]);
                        setFutureAnalysisData((prev: any) => prev || parsed);
                    } catch (e) { }
                }

                // 2. 専門家の抽出 (<expert_generation> タグ)
                const expertMatch = localUnifiedText.match(/<expert_generation>([\s\S]*?)<\/expert_generation>/);
                if (expertMatch) {
                    try {
                        const parsed = JSON.parse(expertMatch[1]);
                        setExperts((prevExperts) => {
                            // 既にキャッシュからセットされている場合は何もしない
                            if (prevExperts.length > 0) return prevExperts;
                            const dynamicExperts = parsed.map((ex: any) => ({ ...ex, avatar: getAvatarForRole(ex.role) }));
                            const fixedExperts = [
                                { role: '節約主婦', name: 'オカン', perspective: '家計のやりくり', tone: 'オカン風', logic_prompt: '', avatar: getAvatarForRole('主婦') },
                                { role: '経営コンサルタント社長', name: 'CEO・剛田', perspective: 'ROI評価', tone: '高圧的', logic_prompt: '', avatar: getAvatarForRole('社長') }
                            ];
                            return [...dynamicExperts, ...fixedExperts];
                        });
                    } catch (e) { }
                }

                // 2.5. 浪費例の抽出 (<waste_examples> タグ)
                const wasteMatch = localUnifiedText.match(/<waste_examples>([\s\S]*?)<\/waste_examples>/);
                if (wasteMatch) {
                    try {
                        const parsed = JSON.parse(wasteMatch[1]);
                        setWasteExamples((prev) => prev.length > 0 ? prev : parsed);
                    } catch (e) { }
                }

                // 3. 発言の抽出 (<debate_turn> タグ)
                // (?:<\/debate_turn>|$) を用いて、ストリーミング途中の未完成タグも拾って描画する
                const turnMatches = [...localUnifiedText.matchAll(/<debate_turn\s+role="([^"]+)"\s+name="([^"]+)"\s*score="([^"]*)">([\s\S]*?)(?:<\/(?:debate_turn)?>|$)/g)];
                if (turnMatches.length > 0) {
                    const parsedMessages = turnMatches.map((match, index) => {
                        const rawTag = match[0];
                        const isFinished = rawTag.includes('</debate_turn>');
                        return {
                            id: `turn_${index}`,
                            role: match[1],
                            name: match[2],
                            score: parseInt(match[3]) || undefined,
                            text: match[4].replace(/<\/?[^>]+(>|$)/g, "").trim(), // 万が一内部にタグが入っても除去
                            isFinished
                        };
                    });
                    setMessages(parsedMessages);
                }

            } else if (data.type === 'final_verdict') {
                setMessages(prev => prev.map(m => ({ ...m, isFinished: true })));
                setDebateFinished(true);
                if (data.futureAnalysis) {
                    setFutureAnalysisData(data.futureAnalysis);
                }
                if (data.wasteExamples) {
                    setWasteExamples(data.wasteExamples);
                }
                sse.close();
            } else if (data.type === 'error') {
                console.error('SSE Error:', data.message);
                setMessages(prev => prev.map(m => ({ ...m, isFinished: true })));
                setDebateFinished(true);
                sse.close();
            } else if (data.type === 'ping') {
                // Heartbeat
            }
        });

        return () => {
            sse.close();
        };
    }, [showDebate, sessionId]);

    // 議論を見るボタンを押した後のタイピング・フェードイン演出




    return (
        <div className="step-container animate-fade-in glass-panel experts-panel">
            <div className="icon-wrapper experts-icon">
                <Users size={48} />
            </div>

            <h2 className="step-title">専門家層による多角的な審議</h2>
            <p className="step-desc text-muted">
                <strong>{subName}</strong> の継続価値について、推進派・慎重派・解約推奨派の各プロフェッショナルが意見を交わしています。
            </p>

            {loadingMsg ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p className="loading-text">{loadingMsg}</p>
                </div>
            ) : (
                <div className="debate-section">
                    <div className="options-pre-debate animate-fade-in">
                        <div className="alert-box">
                            <AlertTriangle size={24} className="alert-icon" />
                            <p>ターゲット捕捉完了。サブスクリプションの真の価値と解約すべきかについて、専門家を召喚して議論を開始します。</p>
                        </div>

                        {!showDebate ? (
                            <div className="btn-group-vertical mt-8">
                                <Button onClick={() => setShowDebate(true)} variant="secondary">
                                    1: 専門家たちの議論を見る
                                </Button>
                                <Button onClick={onNext} variant="danger">
                                    2: 議論を飛ばして結果とヒアリングへ進む
                                </Button>
                            </div>
                        ) : (
                            <div className="chat-container animate-fade-in mt-6 relative pt-12">
                                {/* チャットルームのヘッダー情報 */}
                                <div className="absolute top-0 left-0 right-0 bg-gray-900/60 backdrop-blur-md rounded-t-xl border-b border-gray-700/50 p-2 text-center text-xs text-gray-400 flex items-center justify-center gap-2 z-10">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span>会議ルーム (参加者: 専門家{experts.length}名 + あなた)</span>
                                </div>

                                {messages.map((msg) => {
                                    const ex = experts.find(e => e.role === msg.role);
                                    if (!ex) return null;

                                    const isCurrentlyTalking = !msg.isFinished && !debateFinished;

                                    return (
                                        <div key={msg.id} className="chat-message animate-fade-in">
                                            <div className="chat-avatar">{ex.avatar}</div>
                                            <div className="chat-content">
                                                <div className="chat-name">
                                                    {ex.role} - {ex.name}
                                                    {msg.score !== undefined && (
                                                        <span className={`ml-3 px-2 py-0.5 rounded text-xs font-bold ${msg.score >= 80 ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
                                                            msg.score >= 50 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' :
                                                                'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                                                            } `}>
                                                            解約推奨度: {msg.score}
                                                        </span>
                                                    )}
                                                    {isCurrentlyTalking && <span className="text-blue-400 ml-2 animate-pulse">判定中...</span>}
                                                </div>
                                                <div className={`chat - bubble tone - ${ex.tone === '冷徹' ? 'logical' : ex.tone.includes('オカン') ? 'okan' : ex.tone.includes('高圧的') ? 'ceo' : 'emotional'} `}>
                                                    <p style={{ whiteSpace: 'pre-wrap' }}>
                                                        {msg.text}
                                                        {isCurrentlyTalking && <span className="animate-pulse">|</span>}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {/* 発言がまだ始まっていない場合のシークレット待機表示 */}
                                {messages.length === 0 && (
                                    <div className="chat-message animate-pulse duration-1000">
                                        <div className="chat-avatar">🤖</div>
                                        <div className="chat-content">
                                            <div className="chat-bubble bg-gray-800 border border-gray-700/50">
                                                <p className="text-gray-300">専門家達の会議ルームへ入室しました...</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {debateFinished && (
                                    <div className="next-action-box animate-fade-in" style={{ animationDelay: '0.5s' }}>
                                        <p>専門家たちの推論と議論が完了しました。次はあなたの「今の利用状況」を教えてください。</p>
                                        <Button onClick={() => onNext(futureAnalysisData, wasteExamples)} variant="danger" className="mt-4">
                                            ヒアリングへ進む
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

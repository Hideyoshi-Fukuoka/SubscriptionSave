import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Users, AlertTriangle } from 'lucide-react';
import './Step1_Experts.css';

interface Step1Props {
    subName: string;
    price: number | null;
    onNext: () => void;
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
                // 1. Session Initiate (Orchestratorによる動的アサイン)
                const sessionData = await initiateDeliberation(subName, price);
                if (!isMounted) return;

                setSessionId(sessionData.session_id);

                // 初期状態のエキスパートリストをフロント用に拡張してセット
                const initialExperts = sessionData.expert_selection.map((ex: ExpertSelection) => ({
                    ...ex,
                    avatar: getAvatarForRole(ex.role)
                }));
                setExperts(initialExperts);
                setLoadingMsg('');

            } catch (err) {
                console.error("Initiation Failed", err);
                if (isMounted) setLoadingMsg('専門家の召喚に失敗しました。再試行してください。');
            }
        };

        setupDeliberation();

        return () => { isMounted = false; };
    }, [subName]);

    // 議論開始ボタンが押されたら、SSE通信を開始する
    useEffect(() => {
        if (!showDebate || !sessionId) return;

        const sse = subscribeToDeliberationStream(sessionId, (data) => {
            if (data.type === 'connected') {
                console.log('SSE Connected');
            } else if (data.type === 'agent_start') {
                // 新しい発言（吹き出し）を開始する
                setMessages(prev => {
                    // 以前のすべてのメッセージを「完了」にする
                    const markedPrev = prev.map(m => ({ ...m, isFinished: true }));
                    const msgId = `${data.role}_${data.turn}`;
                    return [...markedPrev, { id: msgId, role: data.role, text: '', isFinished: false }];
                });
            } else if (data.type === 'agent_chunk') {
                // チャンクを受信して最後のメッセージに追記する
                setMessages(prev => {
                    if (prev.length === 0) return prev;
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    // ロールが一致している場合のみ追記（念のため）
                    if (newMessages[lastIndex].role === data.role) {
                        newMessages[lastIndex] = {
                            ...newMessages[lastIndex],
                            text: newMessages[lastIndex].text + data.chunk_text
                        };
                    }
                    return newMessages;
                });
            } else if (data.type === 'agent_score') {
                // スコアを受信してメッセージに紐付ける
                setMessages(prev => {
                    if (prev.length === 0) return prev;
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    if (newMessages[lastIndex].role === data.role) {
                        newMessages[lastIndex] = {
                            ...newMessages[lastIndex],
                            score: data.score
                        };
                    }
                    return newMessages;
                });
            } else if (data.type === 'final_verdict') {
                // 全員の議論終了通知
                setMessages(prev => prev.map(m => ({ ...m, isFinished: true })));
                setDebateFinished(true);
                sse.close();
            } else if (data.type === 'error') {
                console.error('SSE Error:', data.message);
                // エラー時もフリーズを避けるため終了状態にする
                setMessages(prev => prev.map(m => ({ ...m, isFinished: true })));
                setDebateFinished(true);
                sse.close();
            } else if (data.type === 'ping') {
                // バックエンドからのハートビート（タイムアウト防止用）は無視して接続を維持
                // console.log('Heartbeat received.');
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
                            <p>審議が完了しました。かなり厳しい意見が出ているようです。</p>
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
                                                            }`}>
                                                            解約推奨度: {msg.score}
                                                        </span>
                                                    )}
                                                    {isCurrentlyTalking && <span className="text-blue-400 ml-2 animate-pulse">判定中...</span>}
                                                </div>
                                                <div className={`chat-bubble tone-${ex.tone === '冷徹' ? 'logical' : ex.tone.includes('オカン') ? 'okan' : ex.tone.includes('高圧的') ? 'ceo' : 'emotional'}`}>
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
                                        <Button onClick={onNext} variant="danger" className="mt-4">
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

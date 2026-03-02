import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Users, AlertTriangle } from 'lucide-react';
import './Step1_Experts.css';

interface Step1Props {
    subName: string;
    onNext: () => void;
}

import type { ExpertSelection } from '../utils/api';
import { initiateDeliberation, subscribeToDeliberationStream } from '../utils/api';

// UI描画用にセッション中の状態を保持する拡張型
interface ActiveExpert extends ExpertSelection {
    avatar: string; // クライアント側でアイコン(絵文字等)を補完する
    currentChunkText: string;
    isFinished: boolean;
    isActive: boolean; // 現在のターンかどうか
}

export const Step1_Experts: React.FC<Step1Props> = ({ subName, onNext }) => {
    const [showDebate, setShowDebate] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('Orchestratorが最適な専門家を召喚中...');

    // セッションとSSEの参照
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [experts, setExperts] = useState<ActiveExpert[]>([]);

    // 全員の議論が終わったか
    const [debateFinished, setDebateFinished] = useState(false);

    // 専門家ごとのアイコンを適当に割り当てるヘルパー
    const getAvatarForRole = (role: string) => {
        if (role.includes('引退')) return '🥀';
        if (role.includes('社長') || role.includes('コンサル')) return '💼';
        if (role.includes('主婦') || role.includes('ミニマリスト')) return '🌿';
        if (role.includes('ゲーム') || role.includes('スポーツ')) return '🎮';
        if (role.includes('映画') || role.includes('映像')) return '🎬';
        return '👤';
    };

    useEffect(() => {
        let isMounted = true;

        const setupDeliberation = async () => {
            try {
                // 1. Session Initiate (Orchestratorによる動的アサイン)
                const sessionData = await initiateDeliberation(subName);
                if (!isMounted) return;

                setSessionId(sessionData.session_id);

                // 初期状態のエキスパートリストをフロント用に拡張してセット
                const initialExperts = sessionData.expert_selection.map((ex: ExpertSelection) => ({
                    ...ex,
                    avatar: getAvatarForRole(ex.role),
                    currentChunkText: '',
                    isFinished: false,
                    isActive: false
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
            } else if (data.type === 'agent_chunk') {
                // チャンクが届き始めた専門家は「自分のターンが来た」とみなす
                setExperts(prev => {
                    let updated = false;
                    const nextExperts = prev.map(ex => {
                        if (ex.role === data.role) {
                            updated = true;
                            // isActiveフラグ（独自のUI表示用）をtrueにする
                            return { ...ex, currentChunkText: ex.currentChunkText + data.chunk_text, isActive: true };
                        }
                        // 前の人がisActiveになっていれば、その人のisFinishedをtrueに（大雑把なターン判定）
                        if (updated && ex.isActive && !ex.isFinished) {
                            // 厳密には前の人を完了としてマークする処理を入れることも可能だが
                            // 今回はシンプルにchunk_textが追加されていくかで判定
                        }
                        return ex;
                    });

                    // 自分自身の前の専門家は「議論終了」とマークする処理
                    let currentActiveIndex = nextExperts.findIndex(e => e.role === data.role);
                    if (currentActiveIndex > 0) {
                        nextExperts[currentActiveIndex - 1].isFinished = true;
                    }

                    return nextExperts;
                });
            } else if (data.type === 'final_verdict') {
                // 全員の議論終了通知
                setExperts(prev => prev.map(ex => ({ ...ex, isFinished: true })));
                setDebateFinished(true);
                sse.close();
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

            <h2 className="step-title">5名の専門家による審議</h2>
            <p className="step-desc text-muted">
                <strong>{subName}</strong> の継続価値について、各界のプロフェッショナルが意見を交わしています。
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
                            <div className="comments-container animate-fade-in mt-6">
                                {experts.map((ex, idx) => {
                                    // 自分のターンが来ていない（チャンクがない）専門家はまだ見せないか薄く表示
                                    const isWaiting = !ex.currentChunkText && !ex.isActive;
                                    const isCurrentlyTalking = ex.isActive && !ex.isFinished;

                                    if (isWaiting && !showDebate) return null; // 開始前は隠す

                                    return (
                                        <div key={idx} className={`expert-card tone-${ex.tone === '冷徹' ? 'logical' : 'emotional'} ${isWaiting ? 'opacity-30' : ''} ${isCurrentlyTalking ? 'border-l-4 border-blue-400' : ''}`}>
                                            <div className="expert-header">
                                                <span className="expert-avatar">{ex.avatar}</span>
                                                <div className="expert-info">
                                                    <span className="expert-role">{ex.role}</span>
                                                    <span className="expert-name">{ex.name}</span>
                                                </div>
                                                {/* 推論中または待機中インジケーター */}
                                                {isWaiting ? (
                                                    <span className="ml-auto text-xs opacity-50">待機中...</span>
                                                ) : isCurrentlyTalking ? (
                                                    <span className="ml-auto text-xs opacity-50 text-blue-300 animate-pulse">発言中...</span>
                                                ) : (
                                                    <span className="ml-auto text-xs opacity-30 text-green-400 mt-1">✓ 発言完了</span>
                                                )}
                                            </div>
                                            <div className="expert-comment" style={{ whiteSpace: 'pre-wrap' }}>
                                                {/* SSEによるリアルタイムテキストと、点滅するカーソル */}
                                                <p>{ex.currentChunkText || (isWaiting ? "順番を待っています..." : "")}
                                                    {isCurrentlyTalking && <span className="animate-pulse">|</span>}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
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

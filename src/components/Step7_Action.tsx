import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { ExternalLink, AlertOctagon, CheckCircle2, Skull } from 'lucide-react';
import './Step7_Action.css';

interface Step7Props {
    subName: string;
    onReset: () => void;
}

export const Step7_Action: React.FC<Step7Props> = ({ subName, onReset }) => {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="step-container animate-fade-in glass-panel action-panel">
            <div className="icon-wrapper action-icon">
                <AlertOctagon size={48} />
            </div>

            <h2 className="step-title">断捨離の実行</h2>
            <p className="step-desc text-muted">
                決断したなら、今すぐ行動してください。明日やろうは馬鹿野郎です。
            </p>

            {loading ? (
                <div className="loading-state">
                    <div className="spinner-danger"></div>
                    <p className="loading-text text-danger">解約ページのURLと「罠」を特定中...</p>
                </div>
            ) : (
                <div className="action-content animate-fade-in">

                    <div className="trap-alert">
                        <div className="trap-header">
                            <Skull size={24} className="skull-danger" />
                            <h3>警告：解約時の「罠」</h3>
                        </div>
                        <ul className="trap-list">
                            <li><strong>即時利用停止:</strong> 解約した瞬間から視聴や利用ができなくなる可能性があります。</li>
                            <li><strong>ポイント消滅:</strong> 貯まっていたポイントやコインが全て無効になる場合があります。</li>
                            <li><strong>引き止めページ:</strong> 3〜4ページにわたって「本当に解約しますか？」と引き止めるUIが続きます。迷わず進んでください。</li>
                        </ul>
                    </div>

                    <div className="action-links">
                        <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(subName + ' 解約手続き')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cancel-link-btn"
                        >
                            <ExternalLink size={20} />
                            【公式】{subName} の解約ページへ進む
                        </a>
                    </div>

                    <div className="completion-check">
                        <CheckCircle2 size={32} className="check-icon" />
                        <p>解約が完了したら、自分を褒めてあげてください。<br />あなたは一つの無駄を断ち切りました。</p>
                    </div>

                    <div className="mt-8">
                        <Button onClick={onReset} variant="secondary">
                            別のサブスクを審議する（最初に戻る）
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

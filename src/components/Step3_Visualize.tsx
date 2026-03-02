import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Skull, TrendingDown, Package, Smartphone, Flame, AlertCircle } from 'lucide-react';
import './Step3_Visualize.css';

interface Step3Props {
    subName: string;
    frequency: number | null;
    futureAnalysis?: any;
    onNext: () => void;
}

export const Step3_Visualize: React.FC<Step3Props> = ({ subName, frequency, futureAnalysis, onNext }) => {
    const [calculating, setCalculating] = useState(true);

    // モックの月額（本番ではStep0で取得した値を渡すか、グローバルステート管理）
    const monthlyFee = 1500;

    // 実質価値の算出ロジック (frequency: 1=毎日, 2=週2~3回, 3=月数回, 4=1ヶ月未使用, 5=解約忘れ)
    const calculateValue = (freq: number | null) => {
        switch (freq) {
            case 1: return 100;
            case 2: return 70;
            case 3: return 30;
            case 4: return 5;
            case 5: return 0;
            default: return 50;
        }
    };

    const actualValuePercent = calculateValue(frequency);
    const wasteRatio = 100 - actualValuePercent;
    const wasteAmount = Math.floor(monthlyFee * (wasteRatio / 100));

    useEffect(() => {
        let isMounted = true;
        // 擬似的な計算時間（アニメーション用）
        setTimeout(() => {
            if (isMounted) setCalculating(false);
        }, 2000);

        return () => { isMounted = false; };
    }, [subName]);

    const getWasteExamples = (amount: number) => {
        if (amount <= 0) return null;
        return [
            { name: '天狗のビーフジャーキー', count: (amount / 1000).toFixed(1) + '袋分', icon: <Package size={20} /> },
            { name: '特売の卵パック（10個）', count: Math.floor(amount / 250) + 'パック分', icon: <Package size={20} /> },
            { name: 'ガチャ石（単発）', count: Math.floor(amount / 300) + '回分', icon: <Smartphone size={20} /> }
        ];
    };

    const renderWasteVisuals = () => {
        if (wasteAmount === 0) {
            return (
                <div className="excellent-result animate-fade-in">
                    <Flame size={48} className="text-success" />
                    <h3>素晴らしい！</h3>
                    <p>あなたは {subName} を隅々まで使い倒しています。ドブに捨てているお金は0円です。</p>
                </div>
            );
        }

        return (
            <div className="waste-results animate-fade-in">
                <div className="waste-amount-box">
                    <span className="waste-label">毎月、ドブに捨てている金額</span>
                    <h2 className="waste-value">¥{wasteAmount.toLocaleString()}</h2>
                    <span className="waste-sub">（年間 ¥{(wasteAmount * 12).toLocaleString()} の損失）</span>
                </div>

                <p className="harsh-comment">
                    「なんとなく」で払っているそのお金、実体のある価値に換算するとこれだけになります。看過できますか？
                </p>

                <div className="waste-examples">
                    {getWasteExamples(wasteAmount)?.map((ex, idx) => (
                        <div key={idx} className="example-card" style={{ animationDelay: `${idx * 0.2}s` }}>
                            <div className="ex-icon">{ex.icon}</div>
                            <div className="ex-info">
                                <span className="ex-name">{ex.name}</span>
                                <span className="ex-count">{ex.count}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="step-container animate-fade-in glass-panel visualize-panel">
            <div className="icon-wrapper visualize-icon">
                <TrendingDown size={48} />
            </div>

            <h2 className="step-title">価値の算出と可視化</h2>
            <p className="step-desc text-muted">
                あなたの入力データと、現在の利用実態から「真の価値」を計算します。
            </p>

            {calculating ? (
                <div className="calculation-animation">
                    <div className="scan-line"></div>
                    <Skull size={64} className="skull-icon" />
                    <p className="calc-text">無駄をスキャン中...</p>
                    <div className="progress-bar"><div className="progress-fill"></div></div>
                </div>
            ) : (
                <div className="results-container">
                    <div className="value-meter-container">
                        <div className="meter-label">
                            <span>実質的な利用価値</span>
                            <span className={`meter-percent ${actualValuePercent < 50 ? 'text-danger' : 'text-success'}`}>
                                {actualValuePercent}%
                            </span>
                        </div>
                        <div className="meter-bg">
                            <div
                                className={`meter-fill ${actualValuePercent < 50 ? 'bg-danger' : 'bg-success'}`}
                                style={{ width: `${actualValuePercent}%` }}
                            ></div>
                        </div>
                    </div>

                    {renderWasteVisuals()}

                    {futureAnalysis && (
                        <div className="roadmap-alert-box animate-fade-in" style={{ animationDelay: '0.8s' }}>
                            <div className="roadmap-header">
                                <AlertCircle size={24} className={futureAnalysis.future_score >= 8 ? "text-success" : "text-danger"} />
                                <h3>未来予測エージェント (Web検索解析)</h3>
                            </div>
                            <p className="roadmap-verdict">{futureAnalysis.summary}</p>

                            <div className="roadmap-data-grid">
                                <div className="roadmap-data-item">
                                    <span className="data-label">V_future (未来価値プレイスコア)</span>
                                    <span className={`data-value ${futureAnalysis.future_score >= 8 ? 'text-success' : 'text-danger'}`}>
                                        {futureAnalysis.future_score} / 10
                                    </span>
                                </div>
                            </div>

                            {futureAnalysis.upcoming_contents && futureAnalysis.upcoming_contents.length > 0 && (
                                <div className="roadmap-contents">
                                    <h4>【近日配信予定の目玉コンテンツ・アップデート】</h4>
                                    <ul>
                                        {futureAnalysis.upcoming_contents.map((c: string, i: number) => (
                                            <li key={i}>
                                                <span className="content-title" style={{ fontWeight: 'normal' }}>{c}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mt-8 text-center animate-fade-in" style={{ animationDelay: '1s' }}>
                        <Button onClick={onNext} variant="danger">
                            現実を受け入れ、最終判定へ
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

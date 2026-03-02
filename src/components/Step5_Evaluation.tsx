import React, { useState } from 'react';
import { Button } from './Button';
import { Star, ThumbsDown, Zap } from 'lucide-react';
import './Step5_Evaluation.css';

interface Step5Props {
    subName: string;
    wasteAmount: number; // mock calculation again or derived
    onNext: () => void;
    onReset: () => void;
    setSatisfaction: (val: number) => void;
}

export const Step5_Evaluation: React.FC<Step5Props> = ({ subName, wasteAmount, onNext, onReset, setSatisfaction }) => {
    const [selectedRating, setSelectedRating] = useState<number | null>(null);
    const [showResult, setShowResult] = useState(false);

    const handleRating = (rating: number) => {
        setSelectedRating(rating);
        setSatisfaction(rating);
        setTimeout(() => setShowResult(true), 600);
    };

    // 判定ロジックの改善: 評価が4または5であれば基本的に「継続」を許可する
    // ただし、金額計算上でドブ捨てが多すぎる場合は警告を添える
    const isKeep = selectedRating !== null && selectedRating >= 4;
    const isHesitating = selectedRating === 3;

    return (
        <div className="step-container animate-fade-in glass-panel evaluation-panel">
            <div className="icon-wrapper eval-icon">
                <Star size={48} />
            </div>

            <h2 className="step-title">最終的な満足度評価</h2>
            <p className="step-desc text-muted">
                ここまでの試算を見て、あなたは現状の <strong>{subName}</strong> にどれくらい満足していますか？<br />
                直感で評価を下してください。
            </p>

            {!showResult ? (
                <div className="rating-container animate-fade-in">
                    <div className="stars-group">
                        {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                                key={rating}
                                className={`star-btn ${selectedRating === rating ? 'selected' : ''}`}
                                onClick={() => handleRating(rating)}
                            >
                                <Star size={48} fill={selectedRating && selectedRating >= rating ? 'currentColor' : 'none'} />
                                <span className="star-label">{rating}</span>
                            </button>
                        ))}
                    </div>
                    <div className="rating-labels">
                        <span>1 (不満)</span>
                        <span>5 (非常に満足)</span>
                    </div>
                </div>
            ) : (
                <div className="judgment-result animate-fade-in">
                    {isKeep ? (
                        <div className="judgment-keep">
                            <Zap size={64} className="keep-icon text-yellow-400 mb-4" />
                            <h3>【判定】継続を許可します</h3>
                            <p>
                                評価「{selectedRating}」。高い満足度を感じているようですね。<br />
                                {wasteAmount > 1000
                                    ? `ただし、利用頻度からすると推定 ${wasteAmount.toLocaleString()}円 分の元が取れていない可能性があります。上手く活用しましょう。`
                                    : 'あなたにとってこのサブスクは十分な価値を提供しています。'}
                            </p>
                            <Button onClick={onReset} variant="secondary" className="mt-8">
                                別のサブスクを診断する
                            </Button>
                        </div>
                    ) : isHesitating ? (
                        <div className="judgment-cut">
                            <ThumbsDown size={64} className="cut-icon text-red-400 mb-4" />
                            <h3>【判定】断捨離を推奨</h3>
                            <p>
                                評価「3」。可もなく不可もなく、という状態ですね。<br />
                                少しでも迷いがあるなら、それは不要ということです。「とりあえず」の支払いを断ち切りましょう。
                            </p>
                            <Button onClick={onNext} variant="danger" className="mt-8 text-lg">
                                断捨離を開始する（解約サポートへ）
                            </Button>
                        </div>
                    ) : (
                        <div className="judgment-cut">
                            <ThumbsDown size={64} className="cut-icon text-red-600 mb-4" />
                            <h3>【判定】即刻、断捨離の執行令</h3>
                            <p>
                                評価「{selectedRating}」。明確に不満や無駄を感じていますね。<br />
                                これ以上、1円たりともドブに捨てる必要はありません。今すぐ解約手続きを進めましょう。
                            </p>
                            <Button onClick={onNext} variant="danger" className="mt-8 text-lg">
                                断捨離を実行する（解約サポートへ）
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

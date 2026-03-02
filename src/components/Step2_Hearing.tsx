import React, { useState } from 'react';
import { Button } from './Button';
import { ClipboardList } from 'lucide-react';
import './Step2_Hearing.css';

interface Step2Props {
    subName: string;
    setFrequency: (val: number) => void;
    setReason: (val: number[]) => void;
    onNext: () => void;
}

export const Step2_Hearing: React.FC<Step2Props> = ({ subName, setFrequency, setReason, onNext }) => {
    const [currentQ, setCurrentQ] = useState<1 | 2>(1);
    const [localFreq, setLocalFreq] = useState<number | null>(null);

    const [localReasons, setLocalReasons] = useState<number[]>([]);

    const handleFreqSelect = (val: number) => {
        setLocalFreq(val);
        setFrequency(val);
        setTimeout(() => setCurrentQ(2), 400); // 少し待ってアニメーション遷移
    };

    const handleReasonToggle = (val: number) => {
        setLocalReasons(prev =>
            prev.includes(val) ? prev.filter(r => r !== val) : [...prev, val]
        );
    };

    const handleReasonSubmit = () => {
        if (localReasons.length === 0) return;
        setReason(localReasons);
        onNext();
    };

    const freqOptions = [
        { value: 1, label: '毎日' },
        { value: 2, label: '週2〜3回' },
        { value: 3, label: '月数回' },
        { value: 4, label: '1ヶ月使っていない' },
        { value: 5, label: '解約忘れ（存在も忘れていた）' },
    ];

    const reasonOptions = [
        { value: 1, label: '独占コンテンツがあるから' },
        { value: 2, label: '利便性が高いから' },
        { value: 3, label: 'コミュニティ・付き合い' },
        { value: 4, label: '習慣（なんとなく）' },
        { value: 5, label: 'その他' },
    ];

    return (
        <div className="step-container animate-fade-in glass-panel hearing-panel">
            <div className="icon-wrapper hearing-icon">
                <ClipboardList size={48} />
            </div>

            <h2 className="step-title">利用実態のヒアリング</h2>
            <p className="step-desc text-muted">
                正直にお答えください。あなたの見栄や嘘は、すべて数字に見透かされます。
            </p>

            <div className="question-container relative-container">
                {/* Q1 */}
                <div className={`question-block ${currentQ === 1 ? 'active' : 'inactive-prev'}`}>
                    <h3 className="q-title">Q1: <strong>{subName}</strong> の利用頻度は？</h3>
                    <div className="options-grid">
                        {freqOptions.map(opt => (
                            <Button
                                key={opt.value}
                                variant={localFreq === opt.value ? 'danger' : 'primary'}
                                onClick={() => handleFreqSelect(opt.value)}
                                className="hearing-btn"
                            >
                                {opt.label}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Q2 */}
                <div className={`question-block ${currentQ === 2 ? 'active' : 'inactive-next'}`}>
                    <h3 className="q-title">Q2: 継続している理由は？（複数選択可）</h3>
                    <div className="options-grid">
                        {reasonOptions.map(opt => (
                            <Button
                                key={opt.value}
                                variant={localReasons.includes(opt.value) ? 'danger' : 'primary'}
                                onClick={() => handleReasonToggle(opt.value)}
                                className="hearing-btn"
                            >
                                {opt.label}
                            </Button>
                        ))}
                    </div>
                    <div className="flex flex-col items-center mt-6">
                        <Button
                            variant="danger"
                            onClick={handleReasonSubmit}
                            disabled={localReasons.length === 0}
                            className="w-full max-w-xs mb-4"
                        >
                            回答を確定して次へ
                        </Button>
                        <button className="text-btn text-sm" onClick={() => setCurrentQ(1)}>
                            &larr; Q1に戻る
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

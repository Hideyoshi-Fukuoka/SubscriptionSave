import React, { useState } from 'react';
import { Button } from './Button';
import { Search, ShieldAlert } from 'lucide-react';
import './Step0_Input.css';

interface Step0Props {
    subName: string;
    setSubName: (name: string) => void;
    onNext: () => void;
}

const Step0_Input: React.FC<Step0Props> = ({ subName, setSubName, onNext }) => {
    const [priceInfo, setPriceInfo] = useState<{ amount: number | null }>({ amount: null });
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = () => {
        if (!subName.trim()) return;
        setIsSearching(true);
        // モックの検索処理
        setTimeout(() => {
            // 実際はここでAPI連携
            setPriceInfo({ amount: 1500 }); // モックで1500円
            setIsSearching(false);
        }, 1500);
    };

    return (
        <div className="step-container animate-fade-in glass-panel">
            <div className="icon-wrapper">
                <ShieldAlert size={48} className="guardian-icon" />
            </div>

            <h2 className="step-title">私はあなたの家計を守る守護神です。</h2>
            <p className="step-desc text-muted">
                まずは、今回メスを入れたいサブスクリプション名を教えてください。<br />
                私がその価値を徹底的に審議し、ドブに捨てているお金を浮き彫りにします。
            </p>

            {!priceInfo.amount ? (
                <div className="input-group">
                    <input
                        type="text"
                        className="guardian-input"
                        value={subName}
                        onChange={(e) => setSubName(e.target.value)}
                        placeholder="例: Netflix, アマプラ, ジム..."
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button
                        onClick={handleSearch}
                        disabled={!subName.trim() || isSearching}
                        variant="danger"
                    >
                        {isSearching ? '検索中...' : '特定する'} <Search size={18} style={{ marginLeft: '8px' }} />
                    </Button>
                </div>
            ) : (
                <div className="confirmation-card animate-fade-in">
                    <div className="price-alert">
                        <span className="alert-text">【最新情報確認: 2026年版】</span>
                        <h3 className="detected-price">月額 {priceInfo.amount.toLocaleString()}円</h3>
                    </div>
                    <p className="confirm-text">
                        最新の <strong>{subName}</strong> プランでは月額 {priceInfo.amount.toLocaleString()} 円ですが、こちらで合っていますか？
                    </p>

                    <div className="btn-group">
                        <Button onClick={() => setPriceInfo({ amount: null })} variant="secondary">
                            やり直す
                        </Button>
                        <Button onClick={onNext} variant="danger">
                            はい、審議へ進む
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Step0_Input;

import React, { useState } from 'react';
import { Button } from './Button';
import { Search, ShieldAlert } from 'lucide-react';
import { fetchSubscriptionPrice } from '../utils/api';
import './Step0_Input.css';

interface Step0Props {
    subName: string;
    setSubName: (name: string) => void;
    price: number | null;
    setPrice: (price: number | null) => void;
    onNext: () => void;
}

const Step0_Input: React.FC<Step0Props> = ({ subName, setSubName, price, setPrice, onNext }) => {
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        if (!subName.trim()) return;
        setIsSearching(true);

        try {
            // バックエンドAPI経由でGoogle検索を利用し、最新料金と正式名称を推測・取得
            const result = await fetchSubscriptionPrice(subName);
            if (result !== null) {
                setPrice(result.price !== undefined && result.price !== null ? result.price : 1500);
                if (result.formal_name && result.formal_name !== subName) {
                    // 推測された正式名称があれば、自動でサジェスト上書きする
                    setSubName(result.formal_name);
                }
            } else {
                setPrice(1500); // 取得失敗時はフォールバックとして1500をセット
            }
        } catch (error: any) {
            console.error("Error fetching price", error);
            if (error.message && error.message.includes('予算')) {
                alert(error.message);
            }
            setPrice(1500); // エラー時も入力画面には進ませる
        } finally {
            setIsSearching(false);
            setHasSearched(true);
        }
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

            {!hasSearched ? (
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
                        <div className="flex items-center justify-center mt-2">
                            <span className="text-xl mr-2">月額</span>
                            <input
                                type="number"
                                className="guardian-input text-center text-2xl font-bold w-32 bg-gray-800 border-b-2 border-red-500 focus:outline-none"
                                value={price !== null ? price : ''}
                                onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : null)}
                                min="0"
                                step="100"
                            />
                            <span className="text-xl ml-2">円</span>
                        </div>
                    </div>
                    <p className="confirm-text mt-4">
                        <strong>{subName}</strong> の料金はおおよそ上記の金額ですが、実際のあなたの支払い額に合わせて修正してください。
                    </p>

                    <div className="btn-group mt-6">
                        <Button onClick={() => {
                            setPrice(null);
                            setHasSearched(false);
                            setSubName('');
                        }} variant="secondary">
                            やり直す
                        </Button>
                        <Button onClick={onNext} variant="danger" disabled={price === null || price <= 0}>
                            はい、審議へ進む
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Step0_Input;

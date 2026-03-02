// スクレイピングによって取得した（と想定する）LLM-ReadyなMarkdownデータを解析し、
// 未来継続価値（V_future）を算出するためのモックAPI

export type ContentItem = {
    title: string;
    importance: number;   // 1〜10: アップデートや新シーズンの重要度
    probability: number;  // 0.1〜1.0: 実装の確実性（延期リスクなど）
    waitMonths: number;   // T_wait: 実装までの待機期間（月単位）
};

export type RoadmapData = {
    contents: ContentItem[];
    vFuture: number;
    wastedMaintenanceFee: number; // 待機期間中に無駄になる維持費の概算
    verdictMessage: string;
};

const calcVFuture = (contents: ContentItem[]): number => {
    // V_future = Σ (Importance * Probability) / T_wait
    let total = 0;
    for (const c of contents) {
        // 0除算防止
        const wait = Math.max(c.waitMonths, 0.5);
        total += (c.importance * c.probability) / wait;
    }
    return Number(total.toFixed(2));
};

export const fetchRoadmapData = async (subName: string, monthlyFee: number): Promise<RoadmapData | null> => {
    // スクレイピング＆API解析の待機時間を模倣
    await new Promise(resolve => setTimeout(resolve, 3500));

    const lowercaseName = subName.toLowerCase();
    const isNetflix = lowercaseName.includes('netflix') || lowercaseName.includes('ネットフリックス') || lowercaseName.includes('ネトフリ');

    if (!isNetflix) {
        // 第一弾はNetflixのみ対応するため、それ以外はnullを返す
        return null;
    }

    // Netflixのスクレイピング・ロードマップモックデータ
    const netflixContents: ContentItem[] = [
        { title: 'ストレンジャー・シングス 未知の世界 シーズン5', importance: 10, probability: 0.8, waitMonths: 7 },
        { title: 'イカゲーム シーズン3', importance: 9, probability: 0.7, waitMonths: 12 },
        { title: 'ウェンズデー シーズン2', importance: 8, probability: 0.85, waitMonths: 5 },
        { title: '極悪女王 スピンオフ', importance: 6, probability: 0.9, waitMonths: 2 },
    ];

    const vFuture = calcVFuture(netflixContents);

    // 一番待たされる超大型タイトル（importanceが高いもの）を抽出
    const flagship = netflixContents.sort((a, b) => b.importance - a.importance)[0];

    // そのタイトルが来るまでに支払う維持費
    const wastedMaintenanceFee = monthlyFee * flagship.waitMonths;

    let verdictMessage = '';
    if (vFuture < 10) {
        verdictMessage = `最新のスクレイピング解析によると、あなたが心待ちにしている『${flagship.title}』の配信はおよそ${flagship.waitMonths}ヶ月後です。それまでに支払う維持費は推定 ${wastedMaintenanceFee.toLocaleString()}円。「いつでも観られる」は幻想です。配信時に再契約するのが最も合理的な選択です。`;
    } else {
        verdictMessage = `近日中に強力なラインナップが控えています。しかし、それらを本当に全て消化できる時間がありますか？`;
    }

    return {
        contents: netflixContents,
        vFuture,
        wastedMaintenanceFee,
        verdictMessage
    };
};

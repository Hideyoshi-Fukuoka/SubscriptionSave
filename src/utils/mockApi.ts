// モックAPIとしての非同期関数
// 実際にはここでGemini等のAPIを呼び出します

export type ExpertData = {
    role: string;
    name: string;
    comment: string;
    tone: 'harsh' | 'logical' | 'emotional';
    avatar: string; // Emoji
};

export const generateExperts = async (subName: string): Promise<ExpertData[]> => {
    // API通信を模倣する遅延
    await new Promise(resolve => setTimeout(resolve, 3000));

    const name = subName.toLowerCase();

    // ジャンル判定（簡易モックロジック）
    const isGame = name.includes('ゲーム') || name.includes('game') || name.includes('ガチャ');
    const isVOD = name.includes('ネットフリックス') || name.includes('netflix') || name.includes('プライム') || name.includes('アニメ');
    const isFitness = name.includes('ジム') || name.includes('ヨガ') || name.includes('フィットネス');

    // SNSセンチメントモック（High, Neutral, Low）を取得
    // 実際には X API やスクレイピングでハッシュタグの盛り上がりを判定する
    const getMockSentiment = (): 'High' | 'Neutral' | 'Low' => {
        const rand = Math.random();
        if (rand > 0.6) return 'High';
        if (rand > 0.3) return 'Neutral';
        return 'Low';
    };
    const sentiment = getMockSentiment();



    // 固定の2名（家計管理、時間投資）
    const baseExperts: ExpertData[] = [
        {
            role: '一般の主婦（家計管理プロ）',
            name: '鈴木',
            comment: `${subName}に払う分のお金があれば、月に何回スーパーで贅沢できると思ってるんですか？1円の無駄も許しません。`,
            tone: 'harsh',
            avatar: '🛒',
        },
        {
            role: '大企業の社長（時間投資プロ）',
            name: '神宮寺',
            comment: `ビジネスにおいて、「なんとなく」払い続けているコストほど恐ろしいものはない。その${subName}は、将来の自分への投資になっているのか？否だ。`,
            tone: 'logical',
            avatar: '💼',
        }
    ];

    // 動的な3名
    const dynamicExperts: ExpertData[] = [];

    if (isGame) {
        // 感情スコアに応じたセリフの出し分け
        let retiredComment = `また……同じ過ちを繰り返すのですか？ ${subName} のデータはサービス終了と共に電子の海へ消えます。気づいた時には数百万が消えていた私のようにならないでください。`;
        if (sentiment === 'Low') {
            retiredComment = `SNSで検索しましたか？「#${subName}引退」というワードが溢れています。沈みゆく泥舟に、あなただけが課金し続けるつもりですか？目を覚ましてください。`;
        } else if (sentiment === 'High') {
            retiredComment = `今は周年イベント等で盛り上がっているようですね。熱狂に当てられて財布の紐が緩む……一番危険な時期です。運営の集金カーニバルに乗せられてはいけません。`;
        }

        dynamicExperts.push({
            role: '重課金引退勢（元廃神）',
            name: '影山',
            comment: retiredComment,
            tone: 'emotional',
            avatar: '🥀',
        });
        dynamicExperts.push({
            role: 'eスポーツアナリスト',
            name: 'Ryo',
            comment: `プロを目指すなら別ですが、エンジョイ勢にとって毎月の固定費化はコスパ最悪です。ゲームは買い切りしか勝たん。`,
            tone: 'logical',
            avatar: '🎮',
        });
        dynamicExperts.push({
            role: '依存症カウンセラー',
            name: 'Dr.マインド',
            comment: `現実逃避の対価としてお金を払い続けていませんか？ 課金によるドーパミンは一過性に過ぎません。`,
            tone: 'harsh',
            avatar: '🧠',
        });
    } else if (isVOD) {
        dynamicExperts.push({
            role: '映画評論家',
            name: '本田',
            comment: `過去の名作が観られるのは素晴らしいが、本当に毎月見ているのか？「いつでも観られる」は「永遠に観ない」と同義だと言っておこう。`,
            tone: 'logical',
            avatar: '🎬',
        });
        dynamicExperts.push({
            role: 'コンテンツ過多の現代人',
            name: '田中',
            comment: `マイリストだけパンパンに膨れ上がって、結局YouTubeの切り抜き動画ばかり見ていませんか？私には分かります。`,
            tone: 'emotional',
            avatar: '📱',
        });
        dynamicExperts.push({
            role: 'サブスク依存アナリスト',
            name: '佐藤',
            comment: `各社のオリジナル作品のエサに釣られ、複数契約の罠にハマっています。「見たい時に1ヶ月だけ契約」が最適解です。`,
            tone: 'harsh',
            avatar: '💻',
        });
    } else if (isFitness) {
        dynamicExperts.push({
            role: '辛口パーソナルトレーナー',
            name: 'マッスル',
            comment: `「お金を払えば痩せる」という甘え！ 幽霊会員の会費でこの施設は成り立っている！ 今すぐ解約して家で腕立て伏せをしろ！`,
            tone: 'harsh',
            avatar: '💪',
        });
        dynamicExperts.push({
            role: '効率化マニア',
            name: '高橋',
            comment: `往復の移動時間、着替え時間を含めるとタイパが非常に悪い。継続率の統計を見ても、あなたは9割の挫折層に入っています。`,
            tone: 'logical',
            avatar: '⏱️',
        });
        dynamicExperts.push({
            role: '元・意識高い系',
            name: 'ヤマダ',
            comment: `入会した時のあの情熱はどこへ行ったんでしょうか……。ウェアを買って満足していたあの頃の私を見ているようで胸が痛いです。`,
            tone: 'emotional',
            avatar: '🥲',
        });
    } else {
        // デフォルトの動的専門家
        dynamicExperts.push({
            role: 'ITコンサル（サブスク罠アナリスト）',
            name: '佐藤',
            comment: `企業側は「解約を忘れる」ことを計算に入れて${subName}の価格設定をしています。あなたはまんまとその罠にハマっているカモです。`,
            tone: 'harsh',
            avatar: '💻',
        });
        dynamicExperts.push({
            role: 'ミニマリスト',
            name: 'シンプリスト・ケイ',
            comment: `所有しない生き方こそ美しいのですが、使わないものにお金を払い続けるのはただの『執着』です。手放しましょう。`,
            tone: 'logical',
            avatar: '🌿',
        });
        dynamicExperts.push({
            role: '未来のあなた（幻影）',
            name: '???',
            comment: `お願いです、そのお金を貯金に回してください……。5年後の私が、その無駄遣いのせいで泣いています……。`,
            tone: 'emotional',
            avatar: '👻',
        });
    }

    return [...baseExperts, ...dynamicExperts];
};

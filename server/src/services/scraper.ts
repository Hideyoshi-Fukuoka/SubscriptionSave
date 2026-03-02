import puppeteer from 'puppeteer';

/**
 * 指定したURLをPuppeteerで開き、JSによるレンダリングを待機したうえで
 * ページ内の主要なテキストコンテンツを抽出して返す。
 * 
 * @param url スクレイピング対象のURL
 * @param waitForSelector レンダリング完了の目安となるCSSセレクター（任意）
 */
export const scrapeTargetUrl = async (url: string, waitForSelector?: string): Promise<string> => {
    console.log(`[Scraper] Launching browser to scrape: ${url}`);

    const browser = await puppeteer.launch({
        headless: true, // ヘッドレスモード（UIなし）
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--lang=ja-JP' // JPリージョン固定の工夫
        ]
    });

    try {
        const page = await browser.newPage();

        // 偽装用User-Agentを設定し、Bot対策を回避しやすくする
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
        });

        // ページ移動
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // 特定のセレクターが見つかるまで待機（SPAなどの遅延ロード対策）
        if (waitForSelector) {
            await page.waitForSelector(waitForSelector, { timeout: 10000 }).catch(e => {
                console.warn(`[Scraper] waitForSelector target not found: ${waitForSelector}`, e.message);
            });
        }

        // ページ全体のテキストを抽出する（scriptタグやstyleタグは除外）
        const textContent = await page.evaluate(() => {
            const elements = document.body.querySelectorAll('script, style, noscript, nav, footer, header');
            elements.forEach(el => el.parentNode?.removeChild(el));
            return document.body.innerText;
        });

        return textContent;

    } catch (error) {
        console.error(`[Scraper] Error scraping ${url}:`, error);
        throw error;
    } finally {
        await browser.close();
    }
};

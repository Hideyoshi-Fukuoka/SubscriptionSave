import { scrapeTargetUrl } from './services/scraper';
import { analyzeFutureValueContent } from './services/gemini';

async function main() {
    console.log("=== Puppeteer & Gemini Future Value Analysis Test ===");

    // テスト対象: Netflixの国内向け新作情報ページに近いもの（例としてファミ通などのエンタメニュースでも可）
    // 今回は公式のヘルプやNetflix Media Center、もしくは汎用的にアニメやドラマのまとめページ等を想定。
    // ※ 動的に「Netflix 配信予定 2026」などをGoogle検索してトップを開く構成も考えられるが、
    // まずは直接URLを指定してテストする。

    // 公式サイトはBot対策や強力なSPA遅延ロードがあるため、まずは比較的一般的なエンタメ情報メディアの
    // Netflixまとめ記事や検索結果等に近いものをテスト対象とする。
    // 例として、アニメイトタイムズのNetflixアニメまとめ 等
    const targetUrl = 'https://www.animatetimes.com/tag/details.php?id=14603';

    try {
        console.log(`[1] Scraping: ${targetUrl}`);
        const scrapedText = await scrapeTargetUrl(targetUrl);
        console.log(`\n[Scraped Text Length]: ${scrapedText.length} characters.`);
        console.log(`[Preview (first 500 chars)]:\n${scrapedText.substring(0, 500)}...\n`);

        console.log(`[2] Analyzing with Gemini...`);
        const analysis = await analyzeFutureValueContent("Netflix", scrapedText);

        console.log("\n=== Result ===");
        console.log(JSON.stringify(analysis, null, 2));

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

main();

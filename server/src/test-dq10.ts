import { generateExpertSelection, streamExpertDebate } from './services/gemini';
import { ExpertData } from './services/gemini';
import { fetchSubscriptionFutureValue } from './services/gemini';

const test = async () => {
    try {
        console.log("=== Testing DQ10 AI Deliberation ===");
        const name = "DQ10";
        const category = "ゲーム";

        console.log("[1] Generating experts...");
        const experts = await generateExpertSelection(name, category, { frequency: null, reason: [] });

        // DQ10等の場合に追加される予定のベースエキスパートをモック追加
        const baseExperts: ExpertData[] = [
            { role: '一般の主婦', name: '鈴木', perspective: '家計管理', tone: 'harsh', logic_prompt: '無駄を省く' }
        ];
        const allExperts = [...experts, ...baseExperts];
        console.log("-> Experts generated:", allExperts.map(e => e.role).join(', '));

        console.log("\n[2] Fetching future value (Google Search Grounding)...");
        const futureValue = await fetchSubscriptionFutureValue(name);
        console.log("-> Future value:", JSON.stringify(futureValue, null, 2));

        console.log("\n[3] Testing stream for Gamer Retiree (if exists)...");
        const retiree = allExperts.find(e => e.role.includes('引退勢')) || allExperts[0];

        console.log("-> Streaming for:", retiree.role);
        const result = await streamExpertDebate(
            name,
            1500,
            futureValue,
            retiree as any,
            [],
            (chunk) => process.stdout.write(chunk),
            (score) => console.log(`\n\n>> SCORE EXTRACTED: ${score}\n`)
        );

        console.log("\n\n=== Stream Completed Successfully ===");
        console.log("Final Output:", result);

    } catch (e) {
        console.error("\n\n=== FATAL ERROR OCCURRED ===");
        console.error(e);
    }
};

test();

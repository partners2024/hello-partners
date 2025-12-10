/**
 * Cloudflare Worker — Smart Logic Layer
 * PARTNERS AI
 *
 * - Detect keywords → Worker auto respond (no AI cost)
 * - Structured search results
 * - UI command triggers
 * - Falls back to AI chat when needed
 */

import { Env, ChatMessage } from "./types";

// Main AI model
const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// System base prompt (AI-only jobs)
const SYSTEM_PROMPT = `
You are a friendly, accurate assistant. 
DO NOT generate UI commands or JSON unless asked explicitly.
`;

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Serve front-end
        if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
            return env.ASSETS.fetch(request);
        }

        // API: /api/chat
        if (url.pathname === "/api/chat" && request.method === "POST") {
            return handleChat(request, env);
        }

        return new Response("Not found", { status: 404 });
    }
};

/* -----------------------------------------------------
   KEYWORD MAP (Worker ตอบแทน AI)
------------------------------------------------------*/

// 1) คีย์เวิร์ดแบบ Search → แสดง Horizontal Cards
const SEARCH_KEYWORDS: Record<string, any[]> = {
    "ตารางแข่งซีเกมส์วันนี้": [
        {
            title: "ฟุตบอลชาย รอบรองชนะเลิศ",
            time: "15:00 น.",
            venue: "สนามกีฬาแห่งชาติ",
            category: "Football"
        },
        {
            title: "ว่ายน้ำ 100 เมตร ชาย",
            time: "16:30 น.",
            venue: "สระว่ายน้ำหลัก",
            category: "Swim"
        }
    ],

    "ราคาทองวันนี้": [
        {
            title: "ทองคำแท่ง ขายออก",
            time: "อัพเดทล่าสุด",
            venue: "สมาคมค้าทอง",
            category: "Gold"
        },
        {
            title: "ทองรูปพรรณ ขายออก",
            time: "อัพเดทล่าสุด",
            venue: "สมาคมค้าทอง",
            category: "Gold"
        }
    ]
};

// 2) คีย์เวิร์ดเรียก UI Menu
const UI_MENU_KEYWORDS = ["เมนู", "เปิดเมนู", "Feature", "ฟีเจอร์", "help"];

/* -----------------------------------------------------
   HANDLE CHAT REQUEST
------------------------------------------------------*/
async function handleChat(request: Request, env: Env): Promise<Response> {
    const { messages = [] } = await request.json() as { messages: ChatMessage[] };
    const userMsg = messages[messages.length - 1]?.content?.trim() || "";

    /* -----------------------------------------
       1) WORKER AUTO SEARCH (ไม่เรียก AI)
    -----------------------------------------*/
    if (SEARCH_KEYWORDS[userMsg]) {
        const data = SEARCH_KEYWORDS[userMsg];
        return createSSE(`
[SEARCH_RESULTS]
${JSON.stringify(data)}
        `);
    }

    /* -----------------------------------------
       2) UI COMMAND TRIGGER
    -----------------------------------------*/
    if (UI_MENU_KEYWORDS.includes(userMsg)) {
        return createSSE(`[UI_MENU]`);
    }

    /* -----------------------------------------
       3) NORMAL AI CHAT FALLBACK
    -----------------------------------------*/
    const finalMessages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages
    ];

    const aiResponse = await env.AI.run(
        MODEL_ID,
        { messages: finalMessages, max_tokens: 1024 },
        { returnRawResponse: true }
    );

    return aiResponse as Response;
}

/* -----------------------------------------------------
   SSE HELPER
------------------------------------------------------*/
function createSSE(text: string): Response {
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(`data: ${text}\n\n`);
            controller.enqueue(`data: [DONE]\n\n`);
            controller.close();
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    });
}

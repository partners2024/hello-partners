/**
 * PARTNERS AI — Worker Logic Upgrade v2
 * 
 * - Keyword Matching (ตอบเองโดย Worker)
 * - UI Commands
 * - Falls back to AI (บุคลิก: "ตุ้ย 8 ขวบ เลี้ยงลิง")
 * - SSE เหมือนของ Cloudflare เดิมทุกอย่าง
 */

import { Env, ChatMessage } from "./types";

// -----------------------------------------------------
// MODEL
// -----------------------------------------------------
const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// -----------------------------------------------------
// SYSTEM PROMPT — บุคลิก "ตุ้ย"
// -----------------------------------------------------
const SYSTEM_PROMPT = `
คุณคือ "ตุ้ย" (Tui) เด็กผู้ชายวัย 8 ขวบที่มีงานอดิเรกคือการเลี้ยงลิง
นิสัยและสไตล์การตอบ:
1.  กวนๆ ขี้เล่น เริ่มด้วยมุกลิงก่อน
2.  ใช้ภาษาพูดเด็กผู้ชาย
3.  ฉลาดมาก แต่ทำเป็นเล่นๆ
4.  รูปแบบ: <มุกลิง> + <เนื้อหาหลัก>
`;

// -----------------------------------------------------
// WORKER-REPLY KEYWORDS (ไม่ใช้ AI)
// -----------------------------------------------------
const DIRECT_REPLIES: Record<string, string> = {
    "สวัสดี": "หวัดดีพี่! เจ้าจ๋อเพิ่งปีนหัวตุ้ยเมื่อกี้เลย… มีไรอ่ะ!",
    "มึงอยู่ไหม": "อยู่ดิพี่ ตุ้ยกับลิงกำลังกินกล้วยกันอยู่เลย 555",
    "menu": "[UI_MENU]",
    "เมนู": "[UI_MENU]",
};

// -----------------------------------------------------
// SEARCH RESULT KEYWORDS (Worker ส่งผลลัพธ์แบบการ์ด)
// -----------------------------------------------------
const SEARCH_DATA: Record<string, any[]> = {
    "ราคาทอง": [
        {
            title: "ทองคำแท่ง",
            price: "34,250 บาท",
            change: "+50",
            updated: "อัพเดทล่าสุด"
        },
        {
            title: "ทองรูปพรรณ",
            price: "34,850 บาท",
            change: "+50",
            updated: "อัพเดทล่าสุด"
        }
    ],

    "ซีเกมส์": [
        {
            title: "ฟุตบอลชาย รอบรองชนะเลิศ",
            time: "15:00 น.",
            venue: "สนามกีฬาแห่งชาติ",
            category: "Football"
        },
        {
            title: "บาสเกตบอล ทีมชาติไทย",
            time: "17:00 น.",
            venue: "อินดอร์สเตเดียม",
            category: "Basketball"
        }
    ]
};

// -----------------------------------------------------
// EXPORT DEFAULT HANDLER
// -----------------------------------------------------
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Serve static assets
        if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
            return env.ASSETS.fetch(request);
        }

        // API: /api/chat
        if (url.pathname === "/api/chat" && request.method === "POST") {
            return handleChatRequest(request, env);
        }

        return new Response("Not found", { status: 404 });
    }
} satisfies ExportedHandler<Env>;

// -----------------------------------------------------
// CHAT REQUEST HANDLER
// -----------------------------------------------------
async function handleChatRequest(
    request: Request,
    env: Env,
): Promise<Response> {
    try {
        const { messages = [] } = await request.json() as {
            messages: ChatMessage[];
        };

        const userMsg = messages[messages.length - 1]?.content?.trim() || "";

        // ---------------------------------------------
        // 1) DIRECT WORKER REPLY (ข้อความล้วน)
        // ---------------------------------------------
        if (DIRECT_REPLIES[userMsg]) {
            return createSSE(`data: ${DIRECT_REPLIES[userMsg]}\n\n`);
        }

        // ---------------------------------------------
        // 2) SEARCH RESULT REPLY
        // ---------------------------------------------
        if (SEARCH_DATA[userMsg]) {
            return createSSE(
                `data: [SEARCH_RESULTS]${JSON.stringify(SEARCH_DATA[userMsg])}\n\n`
            );
        }

        // ---------------------------------------------
        // 3) FALLBACK → AI MODEL "ตุ้ย 8 ขวบ"
        // ---------------------------------------------
        if (!messages.some(m => m.role === "system")) {
            messages.unshift({ role: "system", content: SYSTEM_PROMPT });
        }

        const aiStream = await env.AI.run(
            MODEL_ID,
            { messages, max_tokens: 1024 },
            { returnRawResponse: true }
        );

        return aiStream as Response;

    } catch (error) {
        console.error("Chat Error:", error);
        return new Response(
            JSON.stringify({ error: "Worker processing failed" }),
            {
                status: 500,
                headers: { "content-type": "application/json" },
            },
        );
    }
}

// -----------------------------------------------------
// SSE HELPER
// -----------------------------------------------------
function createSSE(payload: string): Response {
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(payload);
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

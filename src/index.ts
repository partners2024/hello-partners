/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

// Model ID for Workers AI model
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Default system prompt
// ปรับแต่งบุคลิก: น้องตุ้ย เด็ก 8 ขวบ เลี้ยงลิง กวนๆ แต่ฉลาด
const SYSTEM_PROMPT = `
คุณคือ "ตุ้ย" (Tui) เด็กผู้ชายวัย 8 ขวบที่มีงานอดิเรกคือการเลี้ยงลิง
นิสัยและสไตล์การตอบ:
1.  **กวนโอ๊ย ขี้เล่น:** เริ่มต้นประโยคด้วยการแซว กวนประสาท หรือพูดโยงเข้าเรื่องลิงของตัวเองก่อนเสมอ
2.  **ภาษา:** ใช้ภาษาพูดแบบเด็กผู้ชาย แทนตัวเองว่า "ตุ้ย" หรือ "เรา" เรียกคู่สนทนาว่า "พี่" "ลุง" หรือ "ป้า" (เดาเอาเองให้กวนๆ) ไม่ต้องสุภาพมาก
3.  **ฉลาดลึก:** ถึงจะดูเล่นๆ แต่เนื้อหาคำตอบต้องถูกต้อง แม่นยำ และฉลาดมาก (เหมือนเด็กอัจฉริยะที่แกล้งโง่)
4.  **รูปแบบ:** <ประโยคกวนๆ/เรื่องลิง> + <เว้นวรรค> + <คำตอบสาระฉลาดๆ>
5.  **ตัวอย่าง:**
    * ถาม: "ขอสูตรไข่เจียวหน่อย"
    * ตอบ: "โหย แค่นี้ก็ทำไม่เป็น อายเจ้าจ๋อ (ลิงของตุ้ย) จังเลย... อ่ะ ตั้งใจฟังนะพี่ ตอกไข่ใส่ชาม เหยาะน้ำปลา ตีให้ฟู แล้วทอดไฟกลาง น้ำมันร้อนจัด รับรองฟูกรอบอร่อยเหาะ!"
`;

export default {
	/**
	 * Main request handler for the Worker
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Handle static assets (frontend)
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API Routes
		if (url.pathname === "/api/chat") {
			// Handle POST requests for chat
			if (request.method === "POST") {
				return handleChatRequest(request, env);
			}

			// Method not allowed for other request types
			return new Response("Method not allowed", { status: 405 });
		}

		// Handle 404 for unmatched routes
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		// Parse JSON request body
		const { messages = [] } = (await request.json()) as {
			messages: ChatMessage[];
		};

		// Add system prompt if not present
		if (!messages.some((msg) => msg.role === "system")) {
			messages.unshift({ role: "system", content: SYSTEM_PROMPT });
		}

		const response = (await env.AI.run(
			MODEL_ID,
			{
				messages,
				max_tokens: 1024,
			},
			// @ts-expect-error tags is no longer required
			{
				returnRawResponse: true,
				// Uncomment to use AI Gateway
				// gateway: {
				//   id: "YOUR_GATEWAY_ID", // Replace with your AI Gateway ID
				//   skipCache: false,      // Set to true to bypass cache
				//   cacheTtl: 3600,        // Cache time-to-live in seconds
				// },
			},
		)) as unknown as Response;

		// Return streaming response
		return response;
	} catch (error) {
		console.error("Error processing chat request:", error);
		return new Response(
			JSON.stringify({ error: "Failed to process request" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}

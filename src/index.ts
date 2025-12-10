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
// คุณสามารถแก้ตรงนี้เป็น "น้องตุ้ย" ตามที่เคยคุยกันได้นะครับ
const SYSTEM_PROMPT =
	"You are a helpful, friendly assistant. Provide concise and accurate responses.";

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
		const { messages = [] } = (await request.json()) as {
			messages: ChatMessage[];
		};

		// Extract latest user message
		const userMsg = messages[messages.length - 1]?.content || "";

		// Inject system prompt only once
		if (!messages.some((m) => m.role === "system")) {
			messages.unshift({
				role: "system",
				content: SYSTEM_PROMPT + `
You also have a special mode: When a user asks for real-world schedules, events,
timelines, sports match lists, TV programs, news summaries, economic calendars,
or anything that is best represented as structured cards:

Return the answer in the following exact format:

[SEARCH_RESULTS]
[
  {
    "title": "...",
    "time": "...",
    "venue": "...",
    "category": "..."
  }
]

Rules:
- DO NOT add explanation after the JSON.
- DO NOT wrap JSON in markdown.
- The prefix [SEARCH_RESULTS] must be the first line.
- Use short, clear content for each field.
- Category must be a single word (e.g. Football, Swim, Market).
- If no structured data fits → answer normally.
                `,
			});
		}

		// If question strongly looks like a search → tell model explicitly
		const searchIntent =
			/(แข่ง|ตาราง|ซีเกมส์|ผลบอล|โปรแกรม|ถ่ายทอดสด|ราคาทอง|ข่าว|schedule|match|timeline)/i;

		if (searchIntent.test(userMsg)) {
			messages.push({
				role: "system",
				content: `
User is asking for structured information that fits timeline cards.
Respond using STRICT [SEARCH_RESULTS] JSON format.`,
			});
		}

		// Let AI stream responses back to UI
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

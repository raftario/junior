import { OpenAI } from "openai"
import type { ChatCompletionMessage, ChatCompletionMessageParam } from "openai/resources"

import { config } from "./config.ts"
import { tools } from "./tools.ts"

const openai = new OpenAI({
	baseURL: config.endpoint,
	apiKey: "",
})

export async function completion(
	messages: ChatCompletionMessageParam[],
): Promise<ChatCompletionMessage> {
	const response = await openai.chat.completions.create({
		model: config.model,
		messages,
		tools: tools.descriptions,
		max_completion_tokens: config.truncate,
	})
	const message = response.choices.at(0)!.message

	if (message.tool_calls?.length) {
		messages.push(message)
		for (const call of message.tool_calls.filter((tool) => tool.type === "function")) {
			messages.push(await tools.call(call))
		}
		return completion(messages)
	}

	return message
}

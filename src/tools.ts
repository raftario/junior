import type {
	ChatCompletionMessageFunctionToolCall,
	ChatCompletionTool,
	ChatCompletionToolMessageParam,
} from "openai/resources"
import yaml from "yaml"
import { z } from "zod"

class Tools {
	readonly descriptions: ChatCompletionTool[] = []
	readonly #implementations: Map<string, (params: unknown) => Promise<string>> = new Map()

	add<const Params extends z.ZodObject>(
		name: string,
		description: string,
		params: Params,
		implementation: (this: void, params: z.infer<Params>) => unknown,
	): void {
		this.descriptions.push({
			type: "function",
			function: {
				name,
				description,
				parameters: z.toJSONSchema(params, { io: "input" }),
			},
		})

		this.#implementations.set(name, async (args) => {
			const parsed = await params.safeParseAsync(args)
			if (!parsed.success) {
				return yaml.stringify(z.treeifyError(parsed.error))
			}

			let output: unknown
			try {
				output = await implementation(parsed.data)
			} catch (error) {
				output = error
			}

			if (typeof output === "string") {
				return output
			} else if (output instanceof Error) {
				return yaml.stringify({ errors: [output.message] })
			} else {
				return yaml.stringify(output)
			}
		})
	}

	async call(
		call: ChatCompletionMessageFunctionToolCall,
	): Promise<ChatCompletionToolMessageParam> {
		const message = { role: "tool" as const, tool_call_id: call.id }

		const implementation = this.#implementations.get(call.type)
		if (!implementation) {
			return {
				...message,
				content: yaml.stringify({ errors: [`Unrecognized tool: ${call.function.name}`] }),
			}
		}

		const content = await implementation(call.function.arguments)
		return {
			...message,
			content,
		}
	}
}

export const tools = new Tools()

import { getLlama, LlamaCompletion, LlamaText, SpecialToken } from "node-llama-cpp"

import config from "../config.ts"
import { MODEL } from "../paths.ts"

const STOP_TRIGGERS = [new LlamaText(new SpecialToken("EOS")), new LlamaText("</s>")]
const MAX = 2000

export async function generator(): Promise<
	(input: string | LlamaText, signal?: AbortSignal) => Promise<string>
> {
	const llama = await getLlama()
	const model = await llama.loadModel({ modelPath: MODEL })
	console.log("loaded")
	const context = await model.createContext({
		contextSize: config.contextSize,
		batchSize: config.batchSize,
	})
	console.log("created")
	const completion = new LlamaCompletion({ contextSequence: context.getSequence() })

	return async (input, signal) => {
		const output = await completion.generateCompletion(input, {
			signal,
			repeatPenalty: { penalizeNewLine: false },
			customStopTriggers: STOP_TRIGGERS,
			maxTokens: MAX,
			onTextChunk: (text) => {
				process.stdout.write(text)
			},
			temperature: config.temperature,
			topK: config.topK ?? -1,
			topP: config.topP,
		})
		return output
	}
}

import * as z from "zod"

import { CONFIG } from "./paths.ts"

const schema = z.object({
	contextSize: z
		.number()
		.int()
		.min(1)
		.max(128 * 1024)
		.default(128 * 1024),
	batchSize: z.number().int().min(1).default(64),
	temperature: z.number().min(0.0).default(0.15),
	topK: z.number().int().min(1).optional(),
	topP: z.number().min(0.0).max(1.0).default(1.0),
})

declare global {
	type Config = z.input<typeof schema>
}

export const config: z.infer<typeof schema> = await schema
	.parseAsync(
		await import(CONFIG)
			.then((imported) => imported.default)
			.catch((err) => {
				if ((err as NodeJS.ErrnoException).code !== "ERR_MODULE_NOT_FOUND") {
					console.warn(err)
				}
				return {}
			}),
	)
	.catch((err) => {
		if (err instanceof z.ZodError) {
			console.warn(z.prettifyError(err))
		} else {
			console.warn(err)
		}
		return schema.parseAsync({})
	})

export default config

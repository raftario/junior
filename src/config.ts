import path from "node:path"

import * as z from "zod"

import { CONFIG, ROOT } from "./paths.ts"

const schema = z.object({
	token: z.string(),
	model: z.string(),

	endpoint: z.url().optional(),
	db: z.string().default(path.join(ROOT, "clyde.db")),

	messages: z.int().min(1).default(8),
	max: z.int().min(1).optional(),
})

declare global {
	type Config = z.input<typeof schema>
}

const defaults = {
	token: process.env.TOKEN,
	model: process.env.MODEL,
	host: process.env.HOST,
	db: process.env.DB,
}

const imported = await import(CONFIG)
	.then((imported) => imported.default)
	.catch((err) => {
		if ((err as NodeJS.ErrnoException).code !== "ERR_MODULE_NOT_FOUND") {
			console.warn(err)
		}
		return {}
	})

export const config: z.infer<typeof schema> = await schema
	.parseAsync({ ...defaults, ...imported })
	.catch((err) => {
		if (err instanceof z.ZodError) {
			console.warn(z.prettifyError(err))
		} else {
			console.warn(err)
		}
		return schema.parseAsync(defaults)
	})

if (process.env.DEV) {
	console.dir(config)
}

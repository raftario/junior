import fs from "node:fs/promises"

import { Template } from "@huggingface/jinja"

import { PROMPT } from "./paths.ts"

const raw = await fs.readFile(PROMPT, { encoding: "utf-8" })
const template = new Template(raw)

export function prompt(data: {
	user: string
	tag: string
	server: string
	channel: string
}): string {
	return template.render(data)
}

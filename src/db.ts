import fs from "node:fs/promises"
import { DatabaseSync } from "node:sqlite"

import type { Snowflake } from "discord.js"

import { config } from "./config.ts"
import { SCHEMA } from "./paths.ts"

export const db = new DatabaseSync(config.db)

const schema = await fs.readFile(SCHEMA, { encoding: "utf-8" })
db.exec(schema)

const getPromptStatement = db.prepare("SELECT prompt FROM servers WHERE id = ?")
export function getPrompt(server: Snowflake): string | undefined {
	const prompt = getPromptStatement.get(server)?.prompt as string | null
	return prompt?.trim() || undefined
}

const setPromptStatement = db.prepare(
	"INSERT OR REPLACE INTO servers (id, prompt) VALUES (?, ?)",
)
export function setPrompt(server: Snowflake, prompt: string): void {
	setPromptStatement.run(server, prompt)
}

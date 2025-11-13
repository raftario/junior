import fs from "node:fs/promises"

import { Template } from "@huggingface/jinja"
import type { GuildTextBasedChannel } from "discord.js"

import { getPrompt } from "./db.ts"
import { PROMPT } from "./paths.ts"

const raw = await fs.readFile(PROMPT, { encoding: "utf-8" })
const template = new Template(raw)

export async function prompt(channel: GuildTextBasedChannel): Promise<string> {
	const me = await channel.guild.members.fetchMe()

	const global = template.render({
		name: me.displayName,
		tag: me.user.tag,
		server: channel.guild.name,
		channel: channel.name,
	})
	const server = getPrompt(channel.guild.id)

	const full = [global.trim()]
	if (server) {
		full.push("", server)
	}

	return full.join("\n")
}

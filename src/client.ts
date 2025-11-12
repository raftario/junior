import { Client, GatewayIntentBits } from "discord.js"

import { config } from "./config.ts"

const pending = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
	],
})
pending.login(config.token)

const ready = new Promise<Client<true>>((resolve, reject) =>
	pending
		.on("clientReady", (client) => {
			resolve(client)
		})
		.on("error", (error) => {
			reject(error)
		}),
)

export const client = await ready

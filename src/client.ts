import { Client, Events, GatewayIntentBits } from "discord.js"

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

const ready = new Promise<Client<true>>((resolve, reject) => {
	const onError = (error: Error) => {
		reject(error)
	}

	pending
		.once(Events.ClientReady, (client) => {
			pending.removeListener(Events.Error, onError)
			resolve(client)
		})
		.addListener(Events.Error, onError)
})

export const client = await ready

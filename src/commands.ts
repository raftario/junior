import {
	type ChatInputCommandInteraction,
	type Client,
	Events,
	REST,
	Routes,
	type SlashCommandBuilder,
} from "discord.js"

import { config } from "./config.ts"

class Commands {
	readonly #descriptions: SlashCommandBuilder[] = []
	readonly #implementations: Map<
		string,
		(interaction: ChatInputCommandInteraction) => Promise<void>
	> = new Map()

	add(
		description: SlashCommandBuilder,
		implementation: (interaction: ChatInputCommandInteraction) => Promise<void>,
	): void {
		this.#descriptions.push(description)
		this.#implementations.set(description.name, implementation)
	}

	async register(client: Client<true>): Promise<void> {
		const rest = new REST().setToken(config.token)
		await rest.put(Routes.applicationCommands(client.application.id), {
			body: this.#descriptions,
		})

		client.on(Events.InteractionCreate, (interaction) => {
			if (!interaction.isChatInputCommand()) {
				return
			}

			const implementation = this.#implementations.get(interaction.commandName)
			if (implementation) {
				implementation(interaction).catch(console.error)
			}
		})
	}
}

export const commands = new Commands()

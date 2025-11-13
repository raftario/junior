import { randomUUID } from "node:crypto"

import {
	Events,
	type Interaction,
	InteractionContextType,
	LabelBuilder,
	MessageFlags,
	ModalBuilder,
	PermissionFlagsBits,
	SlashCommandBuilder,
	TextInputBuilder,
	TextInputStyle,
} from "discord.js"

import { commands } from "../commands.ts"
import { getPrompt, setPrompt } from "../db.ts"

commands.add(
	new SlashCommandBuilder()
		.setName("prompt")
		.setDescription("Custom Prompt")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
		.setContexts(InteractionContextType.Guild),

	async (interaction) => {
		const id = randomUUID()
		const server = interaction.guild!

		const input = new TextInputBuilder()
			.setCustomId("prompt")
			.setStyle(TextInputStyle.Paragraph)
			.setRequired(false)

		const current = getPrompt(server.id)
		if (current) {
			input.setValue(current)
		}

		const handler = (interaction: Interaction) => {
			if (!interaction.isModalSubmit() || interaction.customId !== id) {
				return
			}
			interaction.client.removeListener(Events.InteractionCreate, handler)

			const prompt = interaction.fields.getTextInputValue("prompt")
			setPrompt(server.id, prompt)

			interaction
				.reply({
					content: `The custom system prompt for ${server.name} has been updated.`,
					flags: MessageFlags.Ephemeral,
				})
				.catch(console.error)
		}
		setTimeout(
			() => {
				if (interaction.replied) {
					return
				}
				interaction.client.removeListener(Events.InteractionCreate, handler)
			},
			Temporal.Duration.from({ minutes: 4 }).total("milliseconds"),
		)
		interaction.client.addListener(Events.InteractionCreate, handler)

		const modal = new ModalBuilder()
			.setCustomId(id)
			.setTitle("Prompting settings")
			.addLabelComponents(
				new LabelBuilder()
					.setLabel(`Prompt`)
					.setDescription(`Custom system prompt for ${server.name}`)
					.setTextInputComponent(input),
			)
		await interaction.showModal(modal)
	},
)

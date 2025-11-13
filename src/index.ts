import "temporal-polyfill/global"
import "./commands/prompt.ts"

import {
	ChannelType,
	Events,
	type GuildMember,
	type GuildTextBasedChannel,
	type Message,
	MessageType,
	type Snowflake,
} from "discord.js"
import yaml from "yaml"

import { client } from "./client.ts"
import { commands } from "./commands.ts"
import { config } from "./config.ts"
import { completion } from "./openai.ts"
import { prompt } from "./prompt.ts"

const CTX: { last?: Snowflake } = {}

// normalise string by removing accents and lowercasing
function normalize(s: string): string {
	return s
		.normalize("NFKC")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
}

// type in a channel while performing an action
async function typing<T>(channel: GuildTextBasedChannel, f: () => Promise<T>): Promise<T> {
	const typing = setInterval(() => channel.sendTyping().catch(console.error), 1000)
	try {
		return await f()
	} finally {
		clearInterval(typing)
	}
}

// hydrate message contents with mentions
function hydrate(message: string, channel: GuildTextBasedChannel): string {
	const longest = (name: (member: GuildMember) => string) =>
		Array.from(
			channel.guild.members.cache
				.values()
				.map((member) => ({ id: member.id, name: `@${name(member)}` })),
		).sort((a, b) => b.name.length - a.name.length)

	// build a list of usernames to match mentions against, with longer tags > shorter tags > longer display names > shorter display names
	const members = [
		...longest((member) => member.user.tag),
		...longest((member) => member.displayName),
	]

	return message.replace(/@[^@]+/g, (mention) => {
		for (const { name, id } of members) {
			if (mention.startsWith(name)) {
				return `<@${id}>${mention.slice(name.length)}`
			}
		}

		return mention
	})
}

// build the previous messages context by following threads of replies
async function* context(
	message: Message<true>,
	count = 0,
): AsyncGenerator<Message<true>, void, undefined> {
	if (count >= config.messages) {
		return
	}

	yield message
	count++

	const reference = message.reference?.messageId
	if (reference) {
		const next = await message.channel.messages.fetch(reference)
		yield* context(next, count)
		return
	}

	const instant = Temporal.Instant.fromEpochMilliseconds(message.createdTimestamp)
	const cutoff = instant.subtract(config.cutoff)

	const previous = await message.channel.messages.fetch({
		before: message.id,
		limit: config.messages - count,
	})

	yield* [...previous.values()]
		.filter((message) => message.createdTimestamp >= cutoff.epochMilliseconds)
		.sort((a, b) => b.createdTimestamp - a.createdTimestamp)
}

async function reply(message: Message<true>, channel: GuildTextBasedChannel) {
	const me = await channel.guild.members.fetchMe()

	const replied = message.mentions.repliedUser?.id === me.id
	const mentioned =
		message.mentions.users.has(me.id)
		|| normalize(message.cleanContent).includes(normalize(me.displayName))

	if (!replied && !mentioned) {
		return
	}

	const messages = await Array.fromAsync(context(message))
	messages.reverse()

	const user = messages
		.map((message) => {
			const from = `${(message.member ?? message.author).displayName} (@${message.author.tag})`
			const at = Temporal.Instant.fromEpochMilliseconds(message.createdTimestamp).toString()

			const metadata = yaml.stringify({ from, at })
			return ["---", metadata.trim(), "---", "", message.cleanContent.trim(), ""].join("\n")
		})
		.join("\n")
		.trim()

	if (process.env.DEV) {
		console.log(user)
	}

	const system = await prompt(channel)
	const response = await typing(channel, () =>
		completion([
			{
				role: "system",
				content: system,
			},
			{
				role: "user",
				content: user,
			},
		]),
	)

	const content = hydrate(response.content!, channel)
	if (replied || CTX.last !== message.id) {
		await message.reply(content)
	} else {
		await channel.send(content)
	}
}

async function handler(message: Message) {
	CTX.last = message.id

	if (
		message.author.id === client.user.id
		|| ![MessageType.Default, MessageType.Reply].includes(message.type)
		|| !message.inGuild()
	) {
		return
	}

	const channel = message.channel
	if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.PublicThread) {
		return
	}

	return await reply(message, channel)
}

await commands.register(client)
client.on(Events.MessageCreate, async (message) => {
	handler(message).catch(console.error)
})

import "temporal-polyfill/global"

import {
	ChannelType,
	type GuildTextBasedChannel,
	type Message,
	MessageType,
	type Snowflake,
} from "discord.js"
import yaml from "yaml"

import { client } from "./client.ts"
import { config } from "./config.ts"
import { completion } from "./openai.ts"
import { prompt } from "./prompt.ts"

const CTX: { last?: Snowflake } = {}

function normalize(s: string): string {
	return s
		.normalize("NFKC")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
}

async function typing<T>(channel: GuildTextBasedChannel, f: () => Promise<T>): Promise<T> {
	const typing = setInterval(() => channel.sendTyping().catch(console.error), 1000)
	try {
		return await f()
	} finally {
		clearInterval(typing)
	}
}

function hydrate(message: string, channel: GuildTextBasedChannel): string {
	return message.replace(/@(?<tag>[a-z0-9_.]{2,32})/g, (mention) => {
		const member = channel.guild.members.cache.find(
			(member) => member.user.tag === mention.slice(1),
		)
		const id = member?.id

		if (id) {
			return `<@${id}>`
		} else {
			return mention
		}
	})
}

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
	const cutoff = instant.subtract({ hours: 4 })

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

	const summary = messages
		.map((message) => {
			const from = `${(message.member ?? message.author).displayName} (@${message.author.tag})`
			const at = Temporal.Instant.fromEpochMilliseconds(message.createdTimestamp).toString()

			const metadata = yaml.stringify({ from, at })
			return ["---", metadata.trim(), "---", "", message.cleanContent.trim(), ""].join("\n")
		})
		.join("\n")
		.trim()

	if (process.env.DEV) {
		console.log(summary)
	}

	const response = await typing(channel, () =>
		completion([
			{
				role: "system",
				content: prompt({
					user: me.displayName,
					tag: client.user.tag,
					server: channel.guild.name,
					channel: channel.name,
				}),
			},
			{
				role: "user",
				content: summary,
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

client.on("messageCreate", async (message) => {
	handler(message).catch(console.error)
})

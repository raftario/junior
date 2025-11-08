import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import { Readable, Transform, Writable } from "node:stream"
import { pipeline } from "node:stream/promises"

import * as hub from "@huggingface/hub"
import bytes from "bytes"
import ora from "ora"

import * as paths from "../paths.ts"

const REPO = "unsloth/Mistral-Small-3.2-24B-Instruct-2506-GGUF"
const FILE = "Mistral-Small-3.2-24B-Instruct-2506-Q4_K_M.gguf"
const DIGEST = "a3cc56310807ed0d145eaf9f018ccda9ae7ad8edb41ec870aa2454b0d4700b3c"

const spinner = ora("Finding model").start()
function exit(err?: unknown) {
	if (err) {
		spinner.fail(String(err))
		return process.exit(1)
	} else {
		spinner.succeed()
		return process.exit(0)
	}
}

try {
	await using file = await fs.open(paths.MODEL, "a+")
	const stats = await file.stat()
	const hash = createHash("sha256")

	if (stats.size > 0) {
		let verified = 0
		let previous = 0

		const transform = new Writable({
			write(chunk, _encoding, callback) {
				hash.update(chunk)
				verified += (chunk as ArrayBuffer).byteLength
				callback(null)

				const now = performance.now()
				if (now - previous >= 100) {
					spinner.text = `Verifying model (${bytes(verified)}/${bytes(stats.size)})`
					previous = now
				}
			},
		})

		await pipeline(file.createReadStream({ start: 0 }), transform)
		spinner.text = "Veryfing model"
	} else {
		const data = await hub.downloadFile({
			repo: REPO,
			path: FILE,
		})

		if (!data) {
			throw new Error(`${REPO}/${FILE} couldn't be downloaded`)
		}

		let downloaded = 0
		let previous = 0

		const transform = new Transform({
			transform(chunk, _encoding, callback) {
				hash.update(chunk)
				downloaded += (chunk as ArrayBuffer).byteLength
				callback(null, chunk)

				const now = performance.now()
				if (now - previous >= 100) {
					spinner.text = `Downloading model (${bytes(downloaded)}/${bytes(data.size)})`
					previous = now
				}
			},
		})

		await pipeline(Readable.fromWeb(data.stream()), transform, file.createWriteStream())
		spinner.text = "Downloading model"
	}

	if (hash.digest("hex") !== DIGEST) {
		throw new Error("invalid model sha256")
	}

	exit()
} catch (err) {
	exit(err)
}

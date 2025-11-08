import path from "node:path"

export const ROOT = path.dirname(import.meta.dirname)
export const CONFIG = path.join(ROOT, "config.ts")

export const DB = process.env.DB ?? path.join(ROOT, "clyde.db")
export const MODEL = process.env.MODEL ?? path.join(ROOT, "clyde.gguf")

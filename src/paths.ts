import path from "node:path"

export const ROOT = path.dirname(import.meta.dirname)
export const CONFIG = path.join(ROOT, "config.ts")
export const PROMPT = path.join(ROOT, "PROMPT.md")
export const SCHEMA = path.join(ROOT, "SCHEMA.sql")

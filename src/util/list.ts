import type { Iter } from "./iterator.ts"

const PREV = Symbol("prev")
const NEXT = Symbol("next")

const HEAD = Symbol("head")
const TAIL = Symbol("tail")

const SIZE = Symbol("size")
const LIST = Symbol("list")

export class List<T> implements Iterable<T, void, undefined> {
	[HEAD]: Node<T> | undefined;
	[TAIL]: Node<T> | undefined;

	[SIZE]: number = 0

	constructor(...elements: T[]) {
		this.push(...elements)
	}

	static from<T>(iterable: Iterable<T>): List<T> {
		const list = new List<T>()
		for (const value of iterable) {
			list.#push(value)
		}
		return list
	}

	static async fromAsync<T>(iterable: AsyncIterable<T>) {
		const list = new List<T>()
		for await (const value of iterable) {
			list.#push(value)
		}
		return list
	}

	get size(): number {
		return this[SIZE]
	}

	get head(): Node<T> | undefined {
		return this[HEAD]
	}
	get tail(): Node<T> | undefined {
		return this[TAIL]
	}

	set head(value: T) {
		this.#unshift(value)
	}
	set tail(value: T) {
		this.#push(value)
	}

	#index(at: number): number {
		if (at < 0) {
			at = this.size + at
		}
		return at
	}

	#push(value: T) {
		const node = new Node(value, this)
		if (this[TAIL]) {
			node[PREV] = this[TAIL]
			this[TAIL][NEXT] = node
		}

		this[TAIL] = node
		this[HEAD] ??= node
		this[SIZE] += 1
	}

	#unshift(value: T) {
		const node = new Node(value, this)
		if (this[HEAD]) {
			node[NEXT] = this[HEAD]
			this[HEAD][PREV] = node
		}

		this[HEAD] = node
		this[TAIL] ??= node
		this[SIZE] += 1
	}

	at(index: number): T | undefined {
		index = this.#index(index)
		if (index >= this.size) {
			return undefined
		}

		return List.next(this.head).drop(index).next().value?.value
	}

	push(...elements: T[]): number {
		for (const e of elements) {
			this.#push(e)
		}
		return this.size
	}

	pop(): T | undefined {
		const tail = this[TAIL]
		if (!tail) {
			return undefined
		}

		this[TAIL] = tail[PREV]
		tail[PREV] = undefined
		tail[LIST] = undefined

		return tail.value
	}

	unshift(...elements: T[]): number {
		for (const e of elements) {
			this.#unshift(e)
		}
		return this.size
	}

	shift(): T | undefined {
		const head = this[HEAD]
		if (!head) {
			return undefined
		}

		this[HEAD] = head[NEXT]
		head[NEXT] = undefined
		head[LIST] = undefined

		return head.value
	}

	slice(start?: number, end?: number): List<T> {
		start = start !== undefined ? this.#index(start) : 0
		end = end !== undefined ? this.#index(end) : this.size

		return List.from(
			List.next(this.head)
				.drop(start)
				.take(end - start)
				.map((node) => node.value),
		)
	}

	static next<T>(node?: Node<T>): Iterator<T> {
		return new Iterator(node, NEXT)
	}

	static prev<T>(node?: Node<T>): Iterator<T> {
		return new Iterator(node, PREV)
	}

	[Symbol.iterator](): Iter<T> {
		return List.next(this.head).map((node) => node.value)
	}
}

export default List

class Node<T> {
	[PREV]: Node<T> | undefined;
	[NEXT]: Node<T> | undefined;

	[LIST]: List<T> | undefined
	value: T

	constructor(value: T, list: List<T>) {
		this.value = value
		this[LIST] = list
	}

	get linked(): boolean {
		return this[LIST] !== undefined
	}

	get prev(): Node<T> | undefined {
		return this[PREV]
	}
	get next(): Node<T> | undefined {
		return this[NEXT]
	}

	set prev(value: T) {
		if (!this[LIST]) {
			return
		}

		const node = new Node(value, this[LIST])
		node[NEXT] = this
		if (this[PREV]) {
			this[PREV][NEXT] = node
		}
		this[PREV] = node

		if (this[LIST][HEAD] === this) {
			this[LIST][HEAD] = node
		}
		this[LIST][SIZE] += 1
	}

	set next(value: T) {
		if (!this[LIST]) {
			return
		}

		const node = new Node(value, this[LIST])
		node[PREV] = this
		if (this[NEXT]) {
			this[NEXT][PREV] = node
		}
		this[NEXT] = node

		if (this[LIST][TAIL] === this) {
			this[LIST][TAIL] = node
		}
		this[LIST][SIZE] += 1
	}

	remove(): T {
		if (!this[LIST]) {
			return this.value
		}

		if (this[PREV]) {
			this[PREV][NEXT] = this[NEXT]
		}
		if (this[NEXT]) {
			this[NEXT][PREV] = this[PREV]
		}
		if (this[LIST][HEAD] === this) {
			this[LIST][HEAD] = this[NEXT]
		}
		if (this[LIST][TAIL] === this) {
			this[LIST][TAIL] = this[PREV]
		}

		this[PREV] = undefined
		this[NEXT] = undefined
		this[LIST][SIZE] -= 1

		this[LIST] = undefined
		return this.value
	}
}

export type { Node }

class Iterator<T>
	extends globalThis.Iterator<Node<T>, void, undefined>
	implements Iter<Node<T>>
{
	#node: Node<T> | undefined
	#link: typeof NEXT | typeof PREV

	constructor(node: Node<T> | undefined, link: typeof NEXT | typeof PREV) {
		super()
		this.#node = node
		this.#link = link
	}

	reverse(): this {
		if (this.#link === NEXT) {
			this.#link = PREV
		} else {
			this.#link = NEXT
		}
		return this
	}

	override next(): IteratorResult<Node<T>, void> {
		const value = this.#node
		if (value) {
			this.#node = value[this.#link]
			return {
				done: false,
				value,
			}
		} else {
			return {
				done: true,
				value: void undefined,
			}
		}
	}

	override [Symbol.iterator](): this {
		return this
	}
}

export type { Iterator }

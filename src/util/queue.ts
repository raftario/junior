import { List } from "./list.ts"

export type Mode = "bounded" | "unbounded"
export type Ordering = "fifo" | "lifo"

export type Capacity<M extends Mode> = M extends "bounded"
	? number
	: M extends "unbounded"
		? undefined
		: number | undefined
export type Push<M extends Mode> = M extends "bounded"
	? Promise<boolean>
	: M extends "unbounded"
		? boolean
		: Promise<boolean> | boolean

export function bounded<T>(capacity: number, ordering: Ordering = "fifo"): Queue<T, "bounded"> {
	if (!Number.isSafeInteger(capacity) || capacity <= 0) {
		throw new TypeError("`capacity` should be a positive integer")
	}

	return new Queue(ordering, capacity)
}

export function unbounded<T>(ordering: Ordering = "fifo"): Queue<T, "unbounded"> {
	return new Queue(ordering)
}

class Queue<T, M extends Mode = Mode> implements AsyncIterableIterator<T, void, undefined> {
	#backlog = new List<T>()
	ordering: Ordering

	#pop = Promise.withResolvers<void>()
	#closed = false

	#push = Promise.withResolvers<void>()
	readonly #capacity: number

	constructor(ordering: Ordering, capacity?: number) {
		if (!["fifo", "lifo"].includes(ordering)) {
			throw new TypeError("`ordering` should be one of `fifo` or `lifo`")
		}

		this.ordering = ordering
		this.#capacity = capacity ?? 0
	}

	get closed(): boolean {
		return this.closed
	}
	get backlog(): number {
		return this.#backlog.size
	}
	get capacity(): Capacity<M> {
		if (this.#capacity !== 0) {
			return this.#capacity as Capacity<M>
		} else {
			return undefined as Capacity<M>
		}
	}

	async #pushBounded(value: T): Promise<boolean> {
		while (true) {
			if (this.#closed) {
				return false
			} else if (this.#backlog.size < this.#capacity) {
				this.#pop.resolve()
				this.#pop = Promise.withResolvers()

				this.#backlog.push(value)
				return true
			} else {
				await this.#push.promise
			}
		}
	}

	#pushUnbounded(value: T): boolean {
		if (this.#closed) {
			return false
		}

		this.#pop.resolve()
		this.#pop = Promise.withResolvers()

		this.#backlog.push(value)
		return true
	}

	push(value: T): Push<M> {
		if (this.#capacity > 0) {
			return this.#pushBounded(value) as Push<M>
		} else {
			return this.#pushUnbounded(value) as Push<M>
		}
	}

	close(): void {
		this.#pop.resolve()
		this.#pop = Promise.withResolvers()

		this.#closed = true
	}

	[Symbol.asyncIterator](): this {
		return this
	}

	async next(): Promise<IteratorResult<T, void>> {
		while (true) {
			const node = this.ordering === "lifo" ? this.#backlog.tail : this.#backlog.head
			if (node) {
				this.#push.resolve()
				this.#push = Promise.withResolvers()

				return {
					done: false,
					value: node.remove(),
				}
			} else if (this.#closed) {
				return {
					done: true,
					value: void undefined,
				}
			} else {
				await this.#pop.promise
			}
		}
	}
}

export type { Queue }

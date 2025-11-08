import List from "./util/list.ts"
import * as q from "./util/queue.ts"

const queue = q.unbounded<number>()

let n = 0
const interval = setInterval(() => {
	if (n < 10) {
		queue.push(n++)
	} else {
		queue.close()
		clearInterval(interval)
	}
}, 100)

for await (const n of queue) {
	console.log(n)
}

const list = new List<number>()
list.push(0, 1, 2, 3, 4, 5, 6, 7, 8, 9)

console.dir(list.at(-2))

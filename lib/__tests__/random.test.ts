import assert from "node:assert/strict"
import test from "node:test"
import { pickRandom, secureRandomInt, secureRandomString, shuffle } from "@/lib/utils/random"

test("secureRandomInt stays in range", () => {
  for (let i = 0; i < 2000; i++) {
    const n = secureRandomInt(7)
    assert.ok(Number.isInteger(n) && n >= 0 && n < 7)
  }
})

test("secureRandomInt rejects a non-positive bound", () => {
  assert.throws(() => secureRandomInt(0), RangeError)
})

test("secureRandomString uses only the alphabet", () => {
  const value = secureRandomString(64, "ab")
  assert.equal(value.length, 64)
  assert.match(value, /^[ab]+$/)
})

test("shuffle keeps every element and does not mutate the input", () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8]
  const out = shuffle(input)
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8])
  assert.deepEqual(
    [...out].sort((a, b) => a - b),
    input
  )
})

test("shuffle is roughly uniform over first position", () => {
  const counts = [0, 0, 0, 0]
  const runs = 8000
  for (let i = 0; i < runs; i++) counts[shuffle([0, 1, 2, 3])[0]]++
  for (const c of counts) assert.ok(Math.abs(c - runs / 4) < runs * 0.05, `skewed: ${counts.join(",")}`)
})

test("pickRandom handles empty lists", () => {
  assert.equal(pickRandom([]), undefined)
  assert.equal(pickRandom(["only"]), "only")
})

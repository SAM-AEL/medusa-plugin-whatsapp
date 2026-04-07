import assert from "node:assert/strict"
import {
  isLikelyPhone,
  normalizeTemplateVariables,
  parsePagination,
} from "../shared/http"
import { redactSensitiveObject } from "../shared/log-policy"

assert.equal(isLikelyPhone("+91 9876543210"), true)
assert.equal(isLikelyPhone("abc"), false)

const vars = normalizeTemplateVariables({ Name: "Customer", Count: 2 })
assert.equal(vars.Name, "Customer")
assert.equal(vars.Count, "2")

const redacted = redactSensitiveObject({
  access_token: "secret_token",
  recipient_phone: "+919876543210",
  event_name: "order.placed",
})

assert.notEqual(redacted.access_token, "secret_token")
assert.notEqual(redacted.recipient_phone, "+919876543210")
assert.equal(redacted.event_name, "order.placed")

const pagination = parsePagination({ limit: "200", offset: "-1" })
assert.equal(pagination.limit, 100)
assert.equal(pagination.offset, 0)

console.log("mw smoke test passed")

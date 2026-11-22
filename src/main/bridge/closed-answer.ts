// What the bridge answers while it cannot reach the app (spec/mcp-and-agents.md, "Bridge
// mode"; P10-9): the app is not running, agent access is off, there is no token, or the app
// refused the token. Every request gets this JSON-RPC error; a notification or a response
// gets nothing. Only the request's own ID is taken from the message.
import { isJSONRPCRequest, type JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'

export const CLOSED_MESSAGE = 'Open the app and turn on agent access in Settings.'

// A JSON-RPC server error (the range -32000 to -32099 is left to the server).
export const CLOSED_CODE = -32000

export function closedAnswer(message: JSONRPCMessage): JSONRPCMessage | null {
  if (!isJSONRPCRequest(message)) return null
  return { jsonrpc: '2.0', id: message.id, error: { code: CLOSED_CODE, message: CLOSED_MESSAGE } }
}

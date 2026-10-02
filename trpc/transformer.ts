import { SuperJSON } from 'superjson'
import { registerTemporalCodecs } from './temporal.ts'

const superjson = new SuperJSON()
registerTemporalCodecs(superjson)

// A result keeps superjson's JSON half, which already holds a BigInt or a Map as JSON.
export const superjsonTransformer = {
  serialize: (value: unknown): unknown => superjson.serialize(value),
  // A payload with no `json` key is plain JSON, which would otherwise print as null.
  deserialize: (payload: unknown): unknown => {
    const isEnvelope = payload !== null && typeof payload === 'object' && Object.hasOwn(payload, 'json')
    if (!isEnvelope) throw new Error('The payload carries no superjson envelope')

    return Reflect.get(payload, 'json')
  },
}

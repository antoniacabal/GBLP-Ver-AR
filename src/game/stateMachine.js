import { runtime } from './config.js'
const handlers = {}
export const sm = {
    on(state, fn) { handlers[state] = fn },
    go(state) { runtime.state = state; handlers[state]?.() }
}
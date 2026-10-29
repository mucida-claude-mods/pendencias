export type Tick = number

declare module 'claude-code' {
  interface PluginState {
    pendencias: { tick: Tick }
  }
}

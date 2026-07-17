// Typed IPC bridge — thin wrapper over window.electron

declare global {
  interface Window {
    electron: {
      invoke: <T = unknown>(channel: string, args?: unknown) => Promise<T>
      on: (channel: string, listener: (...args: unknown[]) => void) => () => void
      send: (channel: string, args?: unknown) => void
    }
  }
}

export const ipc = {
  invoke: <T = unknown>(channel: string, args?: unknown) =>
    window.electron.invoke<T>(channel, args),
  on: (channel: string, listener: (...args: unknown[]) => void) =>
    window.electron.on(channel, listener),
  send: (channel: string, args?: unknown) =>
    window.electron.send(channel, args)
}

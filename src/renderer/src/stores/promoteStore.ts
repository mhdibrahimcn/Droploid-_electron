import { create } from 'zustand'
import type { TrackInfo, LogLine } from '../../../shared/types/models'

interface PromoteState {
  tracks: TrackInfo[]
  fromTrack: string
  toTrack: string
  loading: boolean
  promoting: boolean
  done: boolean
  logs: LogLine[]

  setTracks: (tracks: TrackInfo[]) => void
  setFromTrack: (track: string) => void
  setToTrack: (track: string) => void
  setLoading: (v: boolean) => void
  setPromoting: (v: boolean) => void
  setDone: (v: boolean) => void
  appendLog: (line: LogLine) => void
  reset: () => void
}

const initialState = {
  tracks: [] as TrackInfo[],
  fromTrack: '',
  toTrack: '',
  loading: true,
  promoting: false,
  done: false,
  logs: [] as LogLine[],
}

export const usePromoteStore = create<PromoteState>((set) => ({
  ...initialState,
  setTracks: (tracks) => set({ tracks }),
  setFromTrack: (fromTrack) => set({ fromTrack }),
  setToTrack: (toTrack) => set({ toTrack }),
  setLoading: (loading) => set({ loading }),
  setPromoting: (promoting) => set({ promoting }),
  setDone: (done) => set({ done }),
  appendLog: (line) => set((s) => ({ logs: [...s.logs.slice(-500), line] })),
  reset: () => set(initialState),
}))

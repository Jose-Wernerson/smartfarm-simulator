import { create } from 'zustand'

interface D {
  active: boolean
  step: number
  auto: boolean
  enterT: number
  setActive: (a: boolean) => void
  setStep: (s: number, t: number) => void
  setAuto: (a: boolean) => void
}
export const useDemo = create<D>((set) => ({
  active: false,
  step: 0,
  auto: true,
  enterT: 0,
  setActive: (active) => set({ active }),
  setStep: (step, enterT) => set({ step, enterT }),
  setAuto: (auto) => set({ auto }),
}))

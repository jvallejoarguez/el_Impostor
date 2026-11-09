import { useLayoutEffect, useRef } from 'react'

// Sizes a heading so its longest word fits on one line. Counting letters can't tell a
// wide "QUANTUMFRACTURE" from a narrow one, so this starts at `size` (any CSS font-size)
// and measures, shrinking until nothing spills past the box. Phrases still wrap between
// words, never inside one. Attach the returned ref; don't also set fontSize in style.
export function useFitText(text, size) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      el.style.fontSize = size
      // Width scales linearly with font size, so one pass lands it; the extra passes only
      // absorb rounding. The 2% spare covers the outline stroke, which isn't measured.
      for (let pass = 0; pass < 3 && el.clientWidth && el.scrollWidth > el.clientWidth; pass++) {
        const current = parseFloat(getComputedStyle(el).fontSize)
        el.style.fontSize = `${Math.floor(current * el.clientWidth / el.scrollWidth * 0.98)}px`
      }
    }
    fit()
    // The display font may arrive after first paint and is wider than the fallback.
    let live = true
    document.fonts?.ready.then(() => live && fit())
    window.addEventListener('resize', fit)
    return () => { live = false; window.removeEventListener('resize', fit) }
  }, [text, size])
  return ref
}

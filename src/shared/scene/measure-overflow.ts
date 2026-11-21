// spec/scene.md "Settling and the overflow measurement": the one overflow test. The 1 pixel
// allows for rounding between systems.
type Measured = Pick<HTMLElement, 'scrollWidth' | 'scrollHeight' | 'clientWidth' | 'clientHeight'>

export function measureOverflow(box: Measured): boolean {
  return box.scrollHeight - box.clientHeight > 1 || box.scrollWidth - box.clientWidth > 1
}

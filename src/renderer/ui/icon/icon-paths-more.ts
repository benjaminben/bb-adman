// The design wave's icons (T3f, spec/app-style.md "Icon rules (design wave)"), drawn for this
// app on the 24 by 24 grid in the built set's stroke style: outlines only, no third-party set.
import type { IconShape } from './icon-paths'

const FRAME = ['rect', { x: '4', y: '4', width: '16', height: '16', rx: '2' }] as const

export const ICON_PATHS_MORE = {
  alignLeft: [['path', { d: 'M4 6h16M4 10h10M4 14h16M4 18h10' }]],
  alignCentre: [['path', { d: 'M4 6h16M7 10h10M4 14h16M7 18h10' }]],
  alignRight: [['path', { d: 'M4 6h16M10 10h10M4 14h16M10 18h10' }]],
  alignTop: [
    ['path', { d: 'M4 4h16' }],
    ['rect', { x: '6', y: '7', width: '4.5', height: '13', rx: '1.2' }],
    ['rect', { x: '13.5', y: '7', width: '4.5', height: '8', rx: '1.2' }],
  ],
  alignMiddle: [
    ['path', { d: 'M3.5 12H6M10.5 12h3M18 12h2.5' }],
    ['rect', { x: '6', y: '5', width: '4.5', height: '14', rx: '1.2' }],
    ['rect', { x: '13.5', y: '8', width: '4.5', height: '8', rx: '1.2' }],
  ],
  alignBottom: [
    ['path', { d: 'M4 20h16' }],
    ['rect', { x: '6', y: '4', width: '4.5', height: '13', rx: '1.2' }],
    ['rect', { x: '13.5', y: '9', width: '4.5', height: '8', rx: '1.2' }],
  ],
  crop: [['path', { d: 'M7 3.5V17h13.5M3.5 7H17v13.5' }]],
  reset: [['path', { d: 'M4 4v4.5h4.5M4 8.5l2.3-2.1A8 8 0 1 1 4 12' }]],
  scissors: [
    ['circle', { cx: '6.5', cy: '7', r: '2.5' }],
    ['circle', { cx: '6.5', cy: '17', r: '2.5' }],
    ['path', { d: 'M8.6 8.4L20 17.5M8.6 15.6L20 6.5' }],
  ],
  fit: [
    ['path', { d: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4' }],
    ['rect', { x: '8', y: '8', width: '8', height: '8', rx: '1' }],
  ],
  fill: [
    ['rect', { x: '3.5', y: '3.5', width: '17', height: '17', rx: '2' }],
    ['path', { d: 'M8 16l8-8M12 8h4v4M8 12v4h4' }],
  ],
  shadeNone: [FRAME, ['path', { d: 'M5 19L19 5' }]],
  shadeBottom: [FRAME, ['path', { d: 'M4 16.5h16M4 13h16' }]],
  shadeTop: [FRAME, ['path', { d: 'M4 7.5h16M4 11h16' }]],
  shadeLeft: [FRAME, ['path', { d: 'M7.5 4v16M11 4v16' }]],
  shadeRight: [FRAME, ['path', { d: 'M16.5 4v16M13 4v16' }]],
  shadeAll: [FRAME, ['rect', { x: '7.5', y: '7.5', width: '9', height: '9', rx: '1' }]],
  allCaps: [['path', { d: 'M3 19l4-14 4 14M4.4 14h5.2M13 19l4-14 4 14M14.4 14h5.2' }]],
  lineHeight: [
    ['path', { d: 'M5 4v16M3 6.5L5 4l2 2.5M3 17.5L5 20l2-2.5M10.5 7H20M10.5 12H20M10.5 17H20' }],
  ],
  letterSpacing: [
    ['path', { d: 'M8.5 13L12 4l3.5 9M9.8 10h4.4' }],
    ['path', { d: 'M4 18h16M6.5 15.5L4 18l2.5 2.5M17.5 15.5L20 18l-2.5 2.5' }],
  ],
  radius: [['path', { d: 'M4 20v-8a8 8 0 0 1 8-8h8' }]],
  padding: [
    ['rect', { x: '3.5', y: '3.5', width: '17', height: '17', rx: '2' }],
    ['rect', { x: '8', y: '8', width: '8', height: '8', rx: '1' }],
    ['path', { d: 'M12 3.5V8M12 16v4.5M3.5 12H8M16 12h4.5' }],
  ],
  speaker: [
    ['path', { d: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z' }],
    ['path', { d: 'M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11' }],
  ],
  speakerOff: [
    ['path', { d: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z' }],
    ['path', { d: 'M15.5 9.5l5 5M20.5 9.5l-5 5' }],
  ],
  pin: [['path', { d: 'M9 4h6M10 4v6l-3 4h10l-3-4V4M12 14v6' }]],
  pencil: [['path', { d: 'M15 5l4 4L8.5 19.5h-4v-4zM13 7l4 4' }]],
  xCircle: [
    ['circle', { cx: '12', cy: '12', r: '8.5' }],
    ['path', { d: 'M9 9l6 6M15 9l-6 6' }],
  ],
  coin: [
    ['circle', { cx: '14.5', cy: '14', r: '6' }],
    ['path', { d: 'M15.2 8A6 6 0 1 0 8.8 16' }],
  ],
  stop: [['rect', { x: '6.5', y: '6.5', width: '11', height: '11', rx: '1.5' }]],
} as const satisfies Record<string, readonly IconShape[]>

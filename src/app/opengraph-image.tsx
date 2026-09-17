import { ImageResponse } from 'next/og'

export const alt = 'Kartikey Pandey — Founder, Karts'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: '#0e1a2b',
          color: '#ffffff',
          display: 'flex',
          height: '100%',
          justifyContent: 'center',
          padding: '72px',
          width: '100%',
        }}
      >
        <div
          style={{
            border: '2px solid #2389d7',
            borderRadius: '28px',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            justifyContent: 'space-between',
            padding: '68px',
            width: '100%',
          }}
        >
          <div style={{ color: '#78b9ec', display: 'flex', fontSize: 30 }}>
            kartikey.fyi
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'flex', fontSize: 78, fontWeight: 700 }}>
              Kartikey Pandey
            </div>
            <div style={{ color: '#78b9ec', display: 'flex', fontSize: 46 }}>
              Founder, Karts
            </div>
          </div>
          <div style={{ background: '#2389d7', display: 'flex', height: 8, width: 180 }} />
        </div>
      </div>
    ),
    size
  )
}

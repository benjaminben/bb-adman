// A short tone as a WAV file (16-bit PCM, mono, 48 kHz), made in the test: no sound file is
// kept in the repository.
export function toneWav(ms: number, hz = 440): Uint8Array {
  const rate = 48_000
  const samples = Math.round((rate * ms) / 1000)
  const data = Buffer.alloc(samples * 2)
  for (let i = 0; i < samples; i++) {
    data.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * hz * i) / rate)), i * 2)
  }
  const head = Buffer.alloc(44)
  head.write('RIFF', 0, 'latin1')
  head.writeUInt32LE(36 + data.length, 4)
  head.write('WAVEfmt ', 8, 'latin1')
  head.writeUInt32LE(16, 16)
  head.writeUInt16LE(1, 20)
  head.writeUInt16LE(1, 22)
  head.writeUInt32LE(rate, 24)
  head.writeUInt32LE(rate * 2, 28)
  head.writeUInt16LE(2, 32)
  head.writeUInt16LE(16, 34)
  head.write('data', 36, 'latin1')
  head.writeUInt32LE(data.length, 40)
  return new Uint8Array(Buffer.concat([head, data]))
}

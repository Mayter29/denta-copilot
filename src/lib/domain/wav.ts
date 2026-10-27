export function wavDuration(buffer: Buffer) {
  if (
    buffer.length < 44 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  )
    throw new Error('Usá un archivo WAV PCM de 16 bits.');
  let byteRate = 0;
  let dataBytes = 0;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const tag = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const begin = offset + 8;
    if (begin + length > buffer.length) throw new Error('El archivo WAV está incompleto.');
    if (tag === 'fmt ') {
      if (
        length < 16 ||
        buffer.readUInt16LE(begin) !== 1 ||
        buffer.readUInt16LE(begin + 14) !== 16 ||
        buffer.readUInt16LE(begin + 2) !== 1
      )
        throw new Error('El audio debe ser WAV PCM de 16 bits y un canal.');
      const sampleRate = buffer.readUInt32LE(begin + 4);
      byteRate = buffer.readUInt32LE(begin + 8);
      if (sampleRate !== 16000 || byteRate !== 32000 || buffer.readUInt16LE(begin + 12) !== 2)
        throw new Error('Usá WAV mono a 16 kHz y 16 bits.');
    }
    if (tag === 'data') dataBytes += length;
    offset = begin + length + (length % 2);
  }
  if (!byteRate || !dataBytes || dataBytes / byteRate > 60)
    throw new Error('El audio debe durar entre 1 y 60 segundos.');
  return dataBytes / byteRate;
}

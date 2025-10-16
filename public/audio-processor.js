class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.bufferSize = 8192
    this.buffer = new Float32Array(this.bufferSize)
    this.bufferIndex = 0
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    if (input.length > 0) {
      const inputChannel = input[0]
      
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex] = inputChannel[i]
        this.bufferIndex++
        
        if (this.bufferIndex >= this.bufferSize) {
          // Calculate RMS for silence detection
          let sum = 0
          for (let j = 0; j < this.bufferSize; j++) {
            sum += this.buffer[j] * this.buffer[j]
          }
          const rms = Math.sqrt(sum / this.bufferSize)
          
          // Only send if not silent (threshold: 0.01)
          if (rms > 0.01) {
            // Convert Float32 to Int16 PCM
            const pcmData = new Int16Array(this.bufferSize)
            for (let j = 0; j < this.bufferSize; j++) {
              const sample = Math.max(-1, Math.min(1, this.buffer[j]))
              pcmData[j] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
            }
            
            // Send audio data to main thread
            this.port.postMessage({
              type: 'audioData',
              data: pcmData.buffer
            })
          }
          
          // Reset buffer
          this.bufferIndex = 0
        }
      }
    }
    
    return true
  }
}

registerProcessor('audio-processor', AudioProcessor)
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.bufferSize = 8192
    this.buffer = new Float32Array(this.bufferSize)
    this.bufferIndex = 0
    this.processCount = 0
    this.audioSentCount = 0
  }

  process(inputs, outputs, parameters) {
    this.processCount++
    
    // Log every 1000 process calls (about every 20 seconds at 48kHz)
    if (this.processCount % 1000 === 0) {
      console.log(`AudioProcessor: ${this.processCount} process calls, ${this.audioSentCount} audio chunks sent`)
    }
    
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
          
          // Debug: log RMS levels
          if (this.audioSentCount < 5 || this.audioSentCount % 10 === 0) {
            console.log(`AudioProcessor: RMS level: ${rms.toFixed(6)}, threshold: 0.001`)
          }
          
          // Only send if not silent (threshold: 0.001 - much lower for better detection)
          if (rms > 0.001) {
            // Convert Float32 to Int16 PCM
            const pcmData = new Int16Array(this.bufferSize)
            for (let j = 0; j < this.bufferSize; j++) {
              const sample = Math.max(-1, Math.min(1, this.buffer[j]))
              pcmData[j] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
            }
            
            this.audioSentCount++
            console.log(`AudioProcessor: Sending audio chunk #${this.audioSentCount}, RMS: ${rms.toFixed(6)}`)
            
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
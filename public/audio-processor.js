class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.bufferSize = 8192 // 8KB buffer
    this.buffer = new Float32Array(this.bufferSize)
    this.bufferIndex = 0
    this.processCount = 0
    this.audioSentCount = 0
    this.testAudioEnabled = false // Flag to enable test audio generation
    
    // Listen for messages from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'enableTestAudio') {
        this.testAudioEnabled = event.data.enabled
        console.log(`AudioProcessor: Test audio ${this.testAudioEnabled ? 'enabled' : 'disabled'}`)
      }
    }
  }

  process(inputs, outputs, parameters) {
    this.processCount++
    
    // Log every 1000 process calls (about every 20 seconds at 48kHz)
    if (this.processCount % 1000 === 0) {
      console.log(`AudioProcessor: ${this.processCount} process calls, ${this.audioSentCount} audio chunks sent`)
    }
    
    const input = inputs[0]
    
    // Debug: Check if we're getting any input at all
    if (this.processCount <= 10) {
      console.log(`AudioProcessor: Process call #${this.processCount}, inputs.length: ${inputs.length}, input.length: ${input ? input.length : 'undefined'}`)
    }
    
    if (input && input.length > 0) {
      const inputChannel = input[0]
      
      // Debug: Check input channel details
      if (this.processCount <= 10) {
        console.log(`AudioProcessor: inputChannel.length: ${inputChannel ? inputChannel.length : 'undefined'}`)
        if (inputChannel && inputChannel.length > 0) {
          console.log(`AudioProcessor: First few samples: [${inputChannel.slice(0, 5).map(s => s.toFixed(6)).join(', ')}]`)
        }
      }
      
      // Generate test audio if enabled (sine wave at 440Hz)
      if (this.testAudioEnabled && inputChannel && inputChannel.length > 0) {
        const frequency = 440 // A4 note
        const amplitude = 0.1 // Low volume
        for (let i = 0; i < inputChannel.length; i++) {
          const time = (this.processCount * 128 + i) / 24000 // Assuming 24kHz sample rate
          inputChannel[i] = amplitude * Math.sin(2 * Math.PI * frequency * time)
        }
        if (this.processCount <= 5) {
          console.log(`AudioProcessor: Generated test audio samples: [${inputChannel.slice(0, 5).join(', ')}]`)
        }
      }
      
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
            console.log(`AudioProcessor: RMS level: ${rms.toFixed(6)}, threshold: DISABLED (sending all audio)`)
          }
          
          // TEMPORARILY DISABLED: Send all audio for debugging
          if (true) { // was: if (rms > 0.001)
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
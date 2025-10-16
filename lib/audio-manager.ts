/**
 * AudioManager - Handles audio playback for Deepgram TTS responses
 * Follows separation of concerns by isolating audio logic from UI components
 */

// Extend Window interface to include webkitAudioContext
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

class AudioManager {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private nextStartTime = 0;
  private audioQueue: AudioBufferSourceNode[] = [];
  private readonly sampleRate = 16000; // Deepgram uses 16kHz
  private readonly channels = 1; // Mono
  private readonly bufferDuration = 0.02; // 20ms chunks
  private readonly crossfadeDuration = 0.005; // 5ms crossfade
  private isFirstChunk = true; // Track first chunk for fade-in
  private readonly frameSize = 960; // Match the professional implementation
  private audioBuffer = new ArrayBuffer(0); // Raw audio buffer
  private isPlaying = false;

  async initAudioContext(): Promise<void> {
    if (!this.audioContext) {
      // Try different AudioContext constructors for cross-browser compatibility
      const AudioContextClass = window.AudioContext || window.webkitAudioContext || AudioContext;
      this.audioContext = new AudioContextClass();
      this.nextStartTime = this.audioContext.currentTime;
      
      // Create a gain node for volume control and smoother audio
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 0.8; // Slightly reduce volume to prevent clipping
      this.gainNode.connect(this.audioContext.destination);
    }

    // Resume audio context if it's suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }





  private applySmoothingFilter(audioData: Float32Array): void {
    // Apply a simple low-pass filter to reduce high-frequency artifacts
    const alpha = 0.1; // Smoothing factor
    for (let i = 1; i < audioData.length; i++) {
      audioData[i] = alpha * audioData[i] + (1 - alpha) * audioData[i - 1];
    }
  }

  private async playPCMChunk(pcmData: Float32Array): Promise<void> {
    if (!this.audioContext || !this.gainNode) {
      throw new Error('AudioContext not initialized');
    }

    // Apply fade-in/fade-out to reduce clicks
    this.applyFadeInOut(pcmData);

    // Create an AudioBuffer for this chunk
    const audioBuffer = this.audioContext.createBuffer(
      this.channels,
      pcmData.length,
      this.sampleRate
    );

    // Copy PCM data to the buffer
    const channelData = audioBuffer.getChannelData(0);
    channelData.set(pcmData);

    // Create a source node
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    
    // Connect through gain node for better control
    source.connect(this.gainNode);

    // Schedule playback to ensure seamless audio
    const currentTime = this.audioContext.currentTime;
    const startTime = Math.max(currentTime, this.nextStartTime);
    
    source.start(startTime);
    
    // Update next start time for seamless playback
    this.nextStartTime = startTime + audioBuffer.duration;
    
    this.isPlaying = true;
    source.onended = () => {
      // Only set to false if this was the last scheduled audio
      if (this.nextStartTime <= this.audioContext!.currentTime + 0.1) {
        this.isPlaying = false;
      }
    };
  }

  private applyFadeInOut(audioData: Float32Array): void {
    const fadeLength = Math.min(Math.floor(this.sampleRate * this.crossfadeDuration), audioData.length / 4);
    
    // Fade in
    for (let i = 0; i < fadeLength; i++) {
      const factor = i / fadeLength;
      audioData[i] *= factor;
    }
    
    // Fade out
    for (let i = audioData.length - fadeLength; i < audioData.length; i++) {
      const factor = (audioData.length - 1 - i) / fadeLength;
      audioData[i] *= factor;
    }
  }

  async playAudio(base64Data: string): Promise<void> {
    if (!this.audioContext || !this.gainNode) {
      await this.initAudioContext()
    }

    try {
      // Add incoming data to buffer
      this.appendToBuffer(base64Data)
      
      // Process complete frames from buffer
      this.processAudioFrames()
    } catch (error) {
      console.error('AudioManager: Failed to play audio:', error)
      throw error
    }
  }

  private appendToBuffer(base64Data: string): void {
    // Convert base64 to ArrayBuffer
    const binaryString = atob(base64Data)
    const newData = new ArrayBuffer(binaryString.length)
    const newView = new Uint8Array(newData)
    
    for (let i = 0; i < binaryString.length; i++) {
      newView[i] = binaryString.charCodeAt(i)
    }

    // Concatenate with existing buffer
    const combinedBuffer = new ArrayBuffer(this.audioBuffer.byteLength + newData.byteLength)
    const combinedView = new Uint8Array(combinedBuffer)
    
    combinedView.set(new Uint8Array(this.audioBuffer), 0)
    combinedView.set(new Uint8Array(newData), this.audioBuffer.byteLength)
    
    this.audioBuffer = combinedBuffer
  }

  private processAudioFrames(): void {
    // Process complete frames from the buffer
    while (this.audioBuffer.byteLength >= this.frameSize) {
      // Extract one frame
      const frameBuffer = this.audioBuffer.slice(0, this.frameSize)
      
      // Remove processed frame from buffer
      this.audioBuffer = this.audioBuffer.slice(this.frameSize)
      
      // Convert frame to audio and play
      this.playAudioFrame(frameBuffer)
    }
  }

  private playAudioFrame(frameBuffer: ArrayBuffer): void {
    const frameView = new Uint8Array(frameBuffer)
    
    // Apply fade-in for first chunk to prevent audio pops
    if (this.isFirstChunk) {
      this.applyFadeInToFrame(frameView)
      this.isFirstChunk = false
    }
    
    // Convert to PCM Float32Array
    const pcmData = this.bufferToPCMFloat32Array(frameView)
    
    // Play the frame
    this.playPCMChunk(pcmData)
  }

  private applyFadeInToFrame(audioBytes: Uint8Array): void {
    // Apply fade-in over first 240 samples (30ms) like the professional implementation
    const fadeLength = Math.min(240, audioBytes.length / 2) // Divide by 2 for 16-bit samples
    
    for (let i = 0; i < fadeLength * 2; i += 2) { // Step by 2 for 16-bit samples
      const fadeRatio = (i / 2) / fadeLength
      
      // Get the 16-bit sample (little-endian)
      const sample = (audioBytes[i + 1] << 8) | audioBytes[i]
      
      // Apply fade-in
      const fadedSample = Math.round(sample * fadeRatio)
      
      // Write back the faded sample
      audioBytes[i] = fadedSample & 0xFF
      audioBytes[i + 1] = (fadedSample >> 8) & 0xFF
    }
  }

  private bufferToPCMFloat32Array(bytes: Uint8Array): Float32Array {
    // Convert to Int16Array (assuming 16-bit PCM)
    const int16Array = new Int16Array(bytes.buffer)
    
    // Convert Int16 to Float32 (normalize to [-1, 1])
    const float32Array = new Float32Array(int16Array.length)
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = Math.max(-1, Math.min(1, int16Array[i] / 32768.0)) // Clamp to prevent distortion
    }
    
    // Apply simple smoothing to reduce clicks and pops
    this.applySmoothingFilter(float32Array)
    
    return float32Array
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  // Reset audio timing (useful when starting a new conversation)
  reset(): void {
    this.stopAllAudio()
    this.isFirstChunk = true
    this.audioBuffer = new ArrayBuffer(0) // Clear the frame buffer
  }

  private stopAllAudio(): void {
    // Stop all currently playing audio sources
    this.audioQueue.forEach(source => {
      try {
        source.stop()
      } catch (e) {
        // Source might already be stopped
      }
    })
    
    // Clear the queue and reset timing
    this.audioQueue = []
    this.isPlaying = false
    
    if (this.audioContext) {
      this.nextStartTime = this.audioContext.currentTime
    }
  }

  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isPlaying = false;
    this.audioQueue = [];
  }
}

// Export a singleton instance
export const audioManager = new AudioManager();
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
  private readonly sampleRate = 24000; // Deepgram uses 24kHz for optimal quality
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
      const pcmData = this.base64ToPCMFloat32Array(base64Data)
      await this.playPCMChunk(pcmData)
    } catch (error) {
      console.error('AudioManager: Failed to play audio:', error)
      throw error
    }
  }

  private createWAVHeader(dataLength: number): Uint8Array {
    // Create WAV header for linear16 audio at 24kHz as per Deepgram docs
    const header = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x00, 0x00, 0x00, 0x00, // Placeholder for file size
      0x57, 0x41, 0x56, 0x45, // "WAVE"
      0x66, 0x6D, 0x74, 0x20, // "fmt "
      0x10, 0x00, 0x00, 0x00, // Chunk size (16)
      0x01, 0x00,             // Audio format (1 for PCM)
      0x01, 0x00,             // Number of channels (1)
      0xC0, 0x5D, 0x00, 0x00, // Sample rate (24000)
      0x80, 0xBB, 0x02, 0x00, // Byte rate (24000 * 2)
      0x02, 0x00,             // Block align (2)
      0x10, 0x00,             // Bits per sample (16)
      0x64, 0x61, 0x74, 0x61, // "data"
      0x00, 0x00, 0x00, 0x00  // Placeholder for data size
    ]);

    // Set file size (header + data - 8 bytes)
    const fileSize = header.length + dataLength - 8;
    header[4] = fileSize & 0xFF;
    header[5] = (fileSize >> 8) & 0xFF;
    header[6] = (fileSize >> 16) & 0xFF;
    header[7] = (fileSize >> 24) & 0xFF;

    // Set data size
    header[40] = dataLength & 0xFF;
    header[41] = (dataLength >> 8) & 0xFF;
    header[42] = (dataLength >> 16) & 0xFF;
    header[43] = (dataLength >> 24) & 0xFF;

    return header;
  }

  private base64ToPCMFloat32Array(base64Data: string): Float32Array {
    // Decode base64 to binary string
    const binaryString = atob(base64Data)
    
    // Convert to Uint8Array
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    // Create WAV header for proper browser playback
    const wavHeader = this.createWAVHeader(bytes.length);
    const wavData = new Uint8Array(wavHeader.length + bytes.length);
    wavData.set(wavHeader, 0);
    wavData.set(bytes, wavHeader.length);
    
    // Apply fade-in for first chunk to prevent audio pops
    if (this.isFirstChunk) {
      this.applyFadeIn(bytes)
      this.isFirstChunk = false
    }
    
    // Convert to Int16Array (assuming 16-bit PCM) - skip WAV header
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

  private applyFadeIn(audioBytes: Uint8Array): void {
    // Apply fade-in over first 240 samples (30ms) to prevent audio pops
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
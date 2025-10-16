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
  private isPlaying = false;
  private nextStartTime = 0;
  private audioQueue: Float32Array[] = [];
  private readonly sampleRate = 16000; // Deepgram typically uses 16kHz
  private readonly channels = 1; // Mono audio
  private readonly bufferDuration = 0.1; // 100ms buffers for smooth playback

  async initAudioContext(): Promise<void> {
    if (!this.audioContext) {
      // Try different AudioContext constructors for cross-browser compatibility
      const AudioContextClass = window.AudioContext || window.webkitAudioContext || AudioContext;
      this.audioContext = new AudioContextClass();
      this.nextStartTime = this.audioContext.currentTime;
    }

    // Resume audio context if it's suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  private base64ToPCMFloat32Array(base64: string): Float32Array {
    // Decode base64 to binary string
    const binaryString = atob(base64);
    
    // Convert to Int16Array (assuming 16-bit PCM)
    const int16Array = new Int16Array(binaryString.length / 2);
    for (let i = 0; i < int16Array.length; i++) {
      const byte1 = binaryString.charCodeAt(i * 2);
      const byte2 = binaryString.charCodeAt(i * 2 + 1);
      // Little-endian 16-bit signed integer
      int16Array[i] = (byte2 << 8) | byte1;
    }
    
    // Convert Int16 to Float32 (normalize to [-1, 1])
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0; // 32768 = 2^15
    }
    
    return float32Array;
  }

  private async playPCMChunk(pcmData: Float32Array): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

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
    source.connect(this.audioContext.destination);

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

  async playAudio(base64Data: string): Promise<void> {
    try {
      await this.initAudioContext();
      
      if (!this.audioContext) {
        throw new Error('Failed to initialize AudioContext');
      }

      // Convert base64 to PCM data
      const pcmData = this.base64ToPCMFloat32Array(base64Data);
      
      // Play the PCM chunk
      await this.playPCMChunk(pcmData);
      
    } catch (error) {
      console.error('AudioManager: Failed to play audio:', error);
      throw error;
    }
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  // Reset audio timing (useful when starting a new conversation)
  reset(): void {
    if (this.audioContext) {
      this.nextStartTime = this.audioContext.currentTime;
    }
    this.isPlaying = false;
    this.audioQueue = [];
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
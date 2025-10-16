/**
 * AudioManager - Handles audio playback for Deepgram TTS responses
 * Follows separation of concerns by isolating audio logic from UI components
 */

// Extend Window interface to include webkitAudioContext
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

export class AudioManager {
  private audioContext: AudioContext | null = null
  private audioQueue: ArrayBuffer[] = []
  private isPlaying = false

  /**
   * Initialize audio context (lazy initialization)
   */
  private initAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext || AudioContext)()
    }
    return this.audioContext
  }

  /**
   * Resume audio context if suspended (required for user interaction)
   */
  private async ensureAudioContextResumed(): Promise<void> {
    const audioContext = this.initAudioContext()
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }
  }

  /**
   * Convert base64 audio data to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  /**
   * Play audio from base64 encoded data
   */
  async playAudio(base64AudioData: string): Promise<void> {
    try {
      await this.ensureAudioContextResumed()
      const audioContext = this.initAudioContext()
      
      // Convert base64 to ArrayBuffer
      const arrayBuffer = this.base64ToArrayBuffer(base64AudioData)
      
      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice())
      
      // Create and play audio source
      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContext.destination)
      
      // Track playing state
      this.isPlaying = true
      source.onended = () => {
        this.isPlaying = false
      }
      
      source.start()
      console.log('Audio playback started')
      
    } catch (error) {
      console.error('AudioManager: Failed to play audio:', error)
      this.isPlaying = false
      throw error
    }
  }

  /**
   * Check if audio is currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying
  }

  /**
   * Clean up audio resources
   */
  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.audioQueue = []
    this.isPlaying = false
  }
}

// Singleton instance for the application
export const audioManager = new AudioManager()
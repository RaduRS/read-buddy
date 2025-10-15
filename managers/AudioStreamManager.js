/**
 * Audio streaming manager - handles all audio-related state and operations
 * Separated for better modularity and testability
 */
export class AudioStreamManager {
  constructor() {
    this.audioBuffer = Buffer.alloc(0);
    this.isStreamingAudio = false;
    this.audioStreamTimeout = null;
    this.pacer = null;
    this.streamSid = null;
    this.twilioWsRef = null;
    this.FRAME_SIZE = 960;
    this.SILENCE_PAYLOAD = Buffer.alloc(this.FRAME_SIZE, 0xff).toString("base64");
  }
  
  resetBuffer() {
    this.audioBuffer = Buffer.alloc(0);
  }
  
  setStreamingState(isStreaming) {
    this.isStreamingAudio = isStreaming;
  }
  
  setStreamReferences(streamSid, twilioWs) {
    this.streamSid = streamSid;
    this.twilioWsRef = twilioWs;
  }
  
  appendToBuffer(data) {
    this.audioBuffer = Buffer.concat([this.audioBuffer, data]);
  }
  
  getBufferSize() {
    return this.audioBuffer.length;
  }
  
  getBuffer() {
    return this.audioBuffer;
  }
  
  extractFrame() {
    if (this.audioBuffer.length >= this.FRAME_SIZE) {
      const frame = this.audioBuffer.subarray(0, this.FRAME_SIZE);
      this.audioBuffer = this.audioBuffer.subarray(this.FRAME_SIZE);
      return frame;
    }
    return null;
  }
  
  setStreamTimeout(callback, delay = 2000) {
    this.clearStreamTimeout();
    this.audioStreamTimeout = setTimeout(callback, delay);
  }
  
  clearStreamTimeout() {
    if (this.audioStreamTimeout) {
      clearTimeout(this.audioStreamTimeout);
      this.audioStreamTimeout = null;
    }
  }
  
  cleanup() {
    this.clearStreamTimeout();
    if (this.pacer) {
      clearInterval(this.pacer);
      this.pacer = null;
    }
    this.resetBuffer();
    this.isStreamingAudio = false;
    this.streamSid = null;
    this.twilioWsRef = null;
  }
}
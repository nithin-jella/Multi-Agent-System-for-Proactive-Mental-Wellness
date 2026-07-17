"use client";

import { useLiveTalkStore } from "@/store/useLiveTalkStore";

const DeviceSelector = () => {
  const {
    microphones,
    speakers,
    voices,
    selectedMicrophone,
    selectedSpeaker,
    selectedVoice,
    setSelectedMicrophone,
    setSelectedSpeaker,
    setSelectedVoice,
  } = useLiveTalkStore();

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="microphone-select" className="block text-sm font-medium text-white/80 mb-2">
          Microphone
        </label>
        <select
          id="microphone-select"
          value={selectedMicrophone || ''}
          onChange={(e) => setSelectedMicrophone(e.target.value)}
          className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] transition-all duration-200"
          disabled={microphones.length === 0}
        >
          {microphones.length > 0 ? (
            microphones.map((mic) => (
              <option key={mic.deviceId} value={mic.deviceId} className="bg-gray-800">
                {mic.label || `Microphone ${mic.deviceId}`}
              </option>
            ))
          ) : (
            <option value="" disabled className="bg-gray-800">No microphones found</option>
          )}
        </select>
      </div>
      <div>
        <label htmlFor="speaker-select" className="block text-sm font-medium text-white/80 mb-2">
          Speaker
        </label>
        <select
          id="speaker-select"
          value={selectedSpeaker || ''}
          onChange={(e) => setSelectedSpeaker(e.target.value)}
          className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] transition-all duration-200"
          disabled={speakers.length === 0}
        >
          {speakers.length > 0 ? (
            speakers.map((speaker) => (
              <option key={speaker.deviceId} value={speaker.deviceId} className="bg-gray-800">
                {speaker.label || `Speaker ${speaker.deviceId}`}
              </option>
            ))
          ) : (
            <option value="" disabled className="bg-gray-800">No speakers found</option>
          )}
        </select>
        <p className="text-xs text-white/50 mt-2">
          Note: Speaker selection may not be supported on all browsers (e.g., Firefox, Safari).
        </p>
      </div>
      <div>
        <label htmlFor="voice-select" className="block text-sm font-medium text-white/80 mb-2">
          AI Voice
        </label>
        <select
          id="voice-select"
          value={selectedVoice || ''}
          onChange={(e) => setSelectedVoice(e.target.value)}
          className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] transition-all duration-200"
          disabled={voices.length === 0}
        >
          {voices.length > 0 ? (
            voices.map((voice) => (
              <option key={`${voice.voiceURI}-${voice.name}`} value={voice.voiceURI} className="bg-gray-800">
                {voice.name} ({voice.lang})
              </option>
            ))
          ) : (
            <option value="" disabled className="bg-gray-800">No voices found</option>
          )}
        </select>
        <p className="text-xs text-white/50 mt-2">
          Note: AI voice selection uses the browser&apos;s built-in voices (TTS).
        </p>
      </div>
    </div>
  );
};

export default DeviceSelector;

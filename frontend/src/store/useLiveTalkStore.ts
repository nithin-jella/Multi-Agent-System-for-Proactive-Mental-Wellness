import { create } from 'zustand';

interface MediaDevice {
  deviceId: string;
  label: string;
  kind: string;
}

interface SpeechSynthesisVoice {
  name: string;
  lang: string;
  voiceURI: string;
}

interface TranscriptSegment {
  id: string;
  text: string;
  final: boolean;
  timestamp: number;
}

const generateTranscriptId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

type LiveTalkState = {
  isLiveTalkActive: boolean;
  isListening: boolean;
  isAikaSpeaking: boolean;
  conversation: { speaker: 'user' | 'aika'; text: string }[];
  microphones: MediaDevice[];
  speakers: MediaDevice[];
  voices: SpeechSynthesisVoice[];
  selectedMicrophone: string | null;
  selectedSpeaker: string | null;
  selectedVoice: string | null;
  spectrogramData: number[];
  liveTranscript: string;
  messageSoundsEnabled: boolean;
  ttsEnabled: boolean;
  transcriptSegments: TranscriptSegment[];
  toggleLiveTalk: () => void;
  setUserSpeaking: (status: boolean) => void;
  setAikaSpeaking: (status: boolean) => void;
  addMessage: (message: { speaker: 'user' | 'aika'; text: string }) => void;
  setMicrophones: (devices: MediaDevice[]) => void;
  setSpeakers: (devices: MediaDevice[]) => void;
  setVoices: (voices: SpeechSynthesisVoice[]) => void;
  setSelectedMicrophone: (deviceId: string) => void;
  setSelectedSpeaker: (deviceId: string) => void;
  setSelectedVoice: (voiceURI: string) => void;
  setSpectrogramData: (data: number[]) => void;
  setLiveTranscript: (text: string) => void;
  setMessageSoundsEnabled: (enabled: boolean) => void;
  setTtsEnabled: (enabled: boolean) => void;
  upsertPartialTranscript: (text: string) => void;
  finalizeTranscript: (text: string) => void;
  resetTranscripts: () => void;
};

export const useLiveTalkStore = create<LiveTalkState>((set) => ({
  isLiveTalkActive: false,
  isListening: false,
  isAikaSpeaking: false,
  conversation: [],
  microphones: [],
  speakers: [],
  voices: [],
  selectedMicrophone: null,
  selectedSpeaker: null,
  selectedVoice: null,
  spectrogramData: Array(16).fill(0),
  liveTranscript: '',
  messageSoundsEnabled: true,
  ttsEnabled: true,
  transcriptSegments: [],
  toggleLiveTalk: () => set((state) => ({ isLiveTalkActive: !state.isLiveTalkActive })),
  setUserSpeaking: (status) => set({ isListening: status }),
  setAikaSpeaking: (status) => set({ isAikaSpeaking: status }),
  addMessage: (message) => set((state) => ({ conversation: [...state.conversation, message] })),
  setMicrophones: (devices) => set({ microphones: devices }),
  setSpeakers: (devices) => set({ speakers: devices }),
  setVoices: (voices) => set((state) => {
    const deduped: SpeechSynthesisVoice[] = [];
    const seen = new Set<string>();
    voices.forEach((voice) => {
      const key = `${voice.voiceURI}|${voice.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(voice);
      }
    });

    const toLower = (value: string | undefined) => (value ? value.toLowerCase() : "");
    const isIndonesian = (voice: SpeechSynthesisVoice) => toLower(voice.lang).startsWith("id");
    const isFemale = (voice: SpeechSynthesisVoice) => /female|wanita|perempuan|girl|cewe/i.test(voice.name);

    const preferredVoice = deduped.find((voice) => isIndonesian(voice) && isFemale(voice))
      || deduped.find((voice) => isIndonesian(voice));

    const currentSelectionStillValid = state.selectedVoice
      ? deduped.some((voice) => voice.voiceURI === state.selectedVoice)
      : false;

    const nextSelected = currentSelectionStillValid
      ? state.selectedVoice
      : preferredVoice?.voiceURI || deduped[0]?.voiceURI || null;

    return { voices: deduped, selectedVoice: nextSelected };
  }),
  setSelectedMicrophone: (deviceId) => set({ selectedMicrophone: deviceId }),
  setSelectedSpeaker: (deviceId) => set({ selectedSpeaker: deviceId }),
  setSelectedVoice: (voiceURI) => set({ selectedVoice: voiceURI }),
  setSpectrogramData: (data) => set({ spectrogramData: data }),
  setLiveTranscript: (text) => set({ liveTranscript: text }),
  setMessageSoundsEnabled: (enabled) => set({ messageSoundsEnabled: enabled }),
  setTtsEnabled: (enabled) => set({ ttsEnabled: enabled }),
  upsertPartialTranscript: (text) => set((state) => {
    const trimmed = text.trim();
    const segments = [...state.transcriptSegments];
    if (!trimmed) {
      if (segments.length && !segments[segments.length - 1].final) {
        segments.pop();
        return { transcriptSegments: segments };
      }
      return {};
    }
    const lastSegment = segments[segments.length - 1];
    const nextSegment: TranscriptSegment = {
      id: lastSegment && !lastSegment.final ? lastSegment.id : generateTranscriptId(),
      text: trimmed,
      final: false,
      timestamp: Date.now(),
    };
    if (lastSegment && !lastSegment.final) {
      segments[segments.length - 1] = nextSegment;
    } else {
      segments.push(nextSegment);
    }
    return { transcriptSegments: segments };
  }),
  finalizeTranscript: (text) => set((state) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return {};
    }
    const segments = [...state.transcriptSegments];
    const lastSegment = segments[segments.length - 1];
    const finalSegment: TranscriptSegment = {
      id: lastSegment && !lastSegment.final ? lastSegment.id : generateTranscriptId(),
      text: trimmed,
      final: true,
      timestamp: Date.now(),
    };
    if (lastSegment && !lastSegment.final) {
      segments[segments.length - 1] = finalSegment;
    } else {
      segments.push(finalSegment);
    }
    return { transcriptSegments: segments };
  }),
  resetTranscripts: () => set({ transcriptSegments: [] }),
}));


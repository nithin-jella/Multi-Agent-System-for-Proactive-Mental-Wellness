import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveTalkStore } from "../store/useLiveTalkStore";
import { type Message as CoreMessage } from "@/types/chat";
import { MicVAD } from "@ricky0123/vad-web";

const STT_WEBSOCKET_URL = "ws://localhost:8001/ws/stt";
const TTS_WEBSOCKET_URL = "ws://localhost:8002/ws/tts";
const SPECTROGRAM_BAR_COUNT = 16;
const SPECTROGRAM_FRAME_INTERVAL_MS = 50;

type BrowserSpeechRecognitionAlternative = {
  transcript: string
  confidence: number
}

type BrowserSpeechRecognitionResult = {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: BrowserSpeechRecognitionAlternative
}

type BrowserSpeechRecognitionEvent = {
  resultIndex: number
  results: {
    readonly length: number
    [index: number]: BrowserSpeechRecognitionResult
  }
}

type BrowserSpeechRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onaudiostart?: (() => void) | null
  onaudioend?: (() => void) | null
  onresult?: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onstart?: (() => void) | null
  onend?: (() => void) | null
  onerror?: ((event: unknown) => void) | null
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

type ExtendedWindow = Window &
  typeof globalThis & {
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };

type SocketStatus = "connecting" | "connected" | "disconnected";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const getBrowserSpeechRecognition = () => {
  const speechWindow = window as ExtendedWindow;
  const SpeechRecognition =
    speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.continuous = true;
    recognition.interimResults = true;
    return recognition;
  }
  return null;
};

const browserTextToSpeech = (
  text: string,
  selectedVoiceURI: string | null,
  onStart: () => void,
  onEnd: () => void,
  onError: (e: unknown) => void,
) => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "id-ID";

  if (selectedVoiceURI) {
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find((voice) => voice.voiceURI === selectedVoiceURI);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
  }

  utterance.onstart = onStart;
  utterance.onend = onEnd;
  utterance.onerror = onError;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
};

interface UseLiveTalkProps {
  onTranscriptReceived: (transcript: string) => void;
  onPartialTranscript: (transcript: string) => void;
  messages: CoreMessage[];
}

export const useLiveTalk = ({
  onTranscriptReceived,
  onPartialTranscript,
  messages,
}: UseLiveTalkProps) => {
  const {
    isLiveTalkActive,
    selectedMicrophone,
    setUserSpeaking,
    setAikaSpeaking,
    setMicrophones,
    setSpeakers,
    setVoices,
    selectedVoice,
    setSpectrogramData,
    setLiveTranscript,
    ttsEnabled,
    upsertPartialTranscript,
    finalizeTranscript,
    resetTranscripts,
  } = useLiveTalkStore();

  const sttSocketRef = useRef<WebSocket | null>(null);
  const ttsSocketRef = useRef<WebSocket | null>(null);
  const micVadRef = useRef<MicVAD | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const browserRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const lastSpokenMessageIdRef = useRef<string | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sttReconnectTimerRef = useRef<number | null>(null);
  const ttsReconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<{ stt: number; tts: number }>({ stt: 0, tts: 0 });

  const [sttSocketStatus, setSttSocketStatus] = useState<SocketStatus>("disconnected");
  const [ttsSocketStatus, setTtsSocketStatus] = useState<SocketStatus>("disconnected");

  const cleanupAudioPipeline = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (error) {
        console.warn("Error disconnecting audio source node", error);
      }
      sourceNodeRef.current = null;
    }

    analyserRef.current = null;
    dataArrayRef.current = null;

    if (micVadRef.current) {
      try {
        micVadRef.current.pause();
        if (
          micVadRef.current.audioContext &&
          micVadRef.current.audioContext.state !== "closed"
        ) {
          void micVadRef.current.audioContext.close();
        }
      } catch (error) {
        console.warn("Error shutting down VAD", error);
      }
      micVadRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
    }
    audioContextRef.current = null;

    if (browserRecognitionRef.current) {
      try {
        browserRecognitionRef.current.stop();
      } catch (error) {
        console.warn("Error stopping speech recognition fallback", error);
      }
      browserRecognitionRef.current = null;
    }

    if (sttReconnectTimerRef.current !== null) {
      window.clearTimeout(sttReconnectTimerRef.current);
      sttReconnectTimerRef.current = null;
    }
    if (ttsReconnectTimerRef.current !== null) {
      window.clearTimeout(ttsReconnectTimerRef.current);
      ttsReconnectTimerRef.current = null;
    }
    reconnectAttemptsRef.current = { stt: 0, tts: 0 };

    setUserSpeaking(false);
    setSpectrogramData(Array(SPECTROGRAM_BAR_COUNT).fill(0));
    setLiveTranscript('');
    resetTranscripts();
  }, [setSpectrogramData, setUserSpeaking, setLiveTranscript, resetTranscripts]);

  useEffect(() => {
    const getDevicesAndVoices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter((device) => device.kind === "audioinput");
        const spks = devices.filter((device) => device.kind === "audiooutput");
        setMicrophones(mics);
        setSpeakers(spks);

        const updateVoices = () => {
          const voices = window.speechSynthesis.getVoices();
          setVoices(voices);
        };
        updateVoices();
        window.speechSynthesis.onvoiceschanged = updateVoices;
      } catch (error) {
        console.error("Error enumerating media devices or voices:", error);
      }
    };

    getDevicesAndVoices();
  }, [setMicrophones, setSpeakers, setVoices]);

  useEffect(() => {
    const resetReconnectState = () => {
      if (sttReconnectTimerRef.current !== null) {
        window.clearTimeout(sttReconnectTimerRef.current);
        sttReconnectTimerRef.current = null;
      }
      if (ttsReconnectTimerRef.current !== null) {
        window.clearTimeout(ttsReconnectTimerRef.current);
        ttsReconnectTimerRef.current = null;
      }
      reconnectAttemptsRef.current = { stt: 0, tts: 0 };
    };

    if (!isLiveTalkActive) {
      resetReconnectState();
      cleanupAudioPipeline();

      if (sttSocketRef.current) {
        sttSocketRef.current.close();
        sttSocketRef.current = null;
      }

      if (ttsSocketRef.current) {
        ttsSocketRef.current.close();
        ttsSocketRef.current = null;
      }

      setSttSocketStatus("disconnected");
      setTtsSocketStatus("disconnected");
      return;
    }

    let cancelled = false;

    function scheduleReconnect(type: "stt" | "tts") {
      if (cancelled || !isLiveTalkActive) {
        return;
      }

      const attempt = reconnectAttemptsRef.current[type] + 1;
      reconnectAttemptsRef.current[type] = attempt;

      const delay = Math.min(500 * 2 ** (attempt - 1), 8000);

      const timer = window.setTimeout(() => {
        if (cancelled || !isLiveTalkActive) {
          return;
        }

        if (type === "stt") {
          connectStt();
        } else {
          connectTts();
        }
      }, delay);

      if (type === "stt") {
        if (sttReconnectTimerRef.current !== null) {
          window.clearTimeout(sttReconnectTimerRef.current);
        }
        sttReconnectTimerRef.current = timer;
      } else {
        if (ttsReconnectTimerRef.current !== null) {
          window.clearTimeout(ttsReconnectTimerRef.current);
        }
        ttsReconnectTimerRef.current = timer;
      }
    }

    function connectStt() {
      if (cancelled || !isLiveTalkActive) {
        return;
      }

      if (
        sttSocketRef.current &&
        (sttSocketRef.current.readyState === WebSocket.OPEN ||
          sttSocketRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      setSttSocketStatus("connecting");

      let ws: WebSocket;
      try {
        ws = new WebSocket(STT_WEBSOCKET_URL);
      } catch (error) {
        console.error("Failed to open STT socket:", error);
        setSttSocketStatus("disconnected");
        scheduleReconnect("stt");
        return;
      }

      sttSocketRef.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          return;
        }
        setSttSocketStatus("connected");
        reconnectAttemptsRef.current.stt = 0;
        if (sttReconnectTimerRef.current !== null) {
          window.clearTimeout(sttReconnectTimerRef.current);
          sttReconnectTimerRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        if (cancelled) {
          return;
        }

        const raw = event.data;
        let handled = false;

        if (typeof raw === "string") {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              if (typeof parsed.partial === "string") {
                const partial = parsed.partial.trim();
                if (partial.length) {
                  setLiveTranscript(partial);
                  upsertPartialTranscript(partial);
                  onPartialTranscript(partial);
                  handled = true;
                } else {
                  upsertPartialTranscript("");
                  setLiveTranscript("");
                }
              }

              if (typeof parsed.final === "string") {
                const finalText = parsed.final.trim();
                if (finalText.length) {
                  finalizeTranscript(finalText);
                  upsertPartialTranscript("");
                  setLiveTranscript("");
                  onPartialTranscript(finalText);
                  onTranscriptReceived(finalText);
                  handled = true;
                }
              }
            }
          } catch (error) {
            console.warn("Unable to parse STT payload:", error);
          }

          if (!handled) {
            const transcript = raw.trim();
            if (transcript) {
              setLiveTranscript(transcript);
              upsertPartialTranscript(transcript);
              onPartialTranscript(transcript);
              finalizeTranscript(transcript);
              upsertPartialTranscript("");
              setLiveTranscript("");
              onTranscriptReceived(transcript);
            } else {
              upsertPartialTranscript("");
              setLiveTranscript("");
            }
          }
        }
      };

      ws.onerror = (event) => {
        console.error("STT socket error", event);
        try {
          ws.close();
        } catch (error) {
          console.warn("Error closing STT socket after error", error);
        }
      };

      ws.onclose = () => {
        setSttSocketStatus("disconnected");
        if (sttSocketRef.current === ws) {
          sttSocketRef.current = null;
        }
        if (!cancelled && isLiveTalkActive) {
          scheduleReconnect("stt");
        }
      };
    }

    function connectTts() {
      if (cancelled || !isLiveTalkActive) {
        return;
      }

      if (
        ttsSocketRef.current &&
        (ttsSocketRef.current.readyState === WebSocket.OPEN ||
          ttsSocketRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      setTtsSocketStatus("connecting");

      let ws: WebSocket;
      try {
        ws = new WebSocket(TTS_WEBSOCKET_URL);
      } catch (error) {
        console.error("Failed to open TTS socket:", error);
        setTtsSocketStatus("disconnected");
        scheduleReconnect("tts");
        return;
      }

      ttsSocketRef.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          return;
        }
        setTtsSocketStatus("connected");
        reconnectAttemptsRef.current.tts = 0;
        if (ttsReconnectTimerRef.current !== null) {
          window.clearTimeout(ttsReconnectTimerRef.current);
          ttsReconnectTimerRef.current = null;
        }
      };

      ws.onmessage = () => {
        // Audio streaming will be handled when backend support is ready.
      };

      ws.onerror = (event) => {
        console.error("TTS socket error", event);
        try {
          ws.close();
        } catch (error) {
          console.warn("Error closing TTS socket after error", error);
        }
      };

      ws.onclose = () => {
        setTtsSocketStatus("disconnected");
        if (ttsSocketRef.current === ws) {
          ttsSocketRef.current = null;
        }
        if (!cancelled && isLiveTalkActive) {
          scheduleReconnect("tts");
        }
      };
    }

    connectStt();
    connectTts();

    return () => {
      cancelled = true;
      resetReconnectState();

      if (sttSocketRef.current) {
        try {
          sttSocketRef.current.close();
        } catch (error) {
          console.warn("Error closing STT socket during cleanup", error);
        }
        sttSocketRef.current = null;
      }

      if (ttsSocketRef.current) {
        try {
          ttsSocketRef.current.close();
        } catch (error) {
          console.warn("Error closing TTS socket during cleanup", error);
        }
        ttsSocketRef.current = null;
      }

      setSttSocketStatus("disconnected");
      setTtsSocketStatus("disconnected");
      cleanupAudioPipeline();
    };
  }, [
    cleanupAudioPipeline,
    finalizeTranscript,
    isLiveTalkActive,
    onPartialTranscript,
    onTranscriptReceived,
    setLiveTranscript,
    upsertPartialTranscript,
  ]);

  useEffect(() => {
    if (!isLiveTalkActive) {
      return;
    }

    let cancelled = false;

    const initialiseAudioPipeline = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        mediaStreamRef.current = stream;

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.85;
        analyserRef.current = analyser;

        const sourceNode = audioContext.createMediaStreamSource(stream);
        sourceNodeRef.current = sourceNode;
        sourceNode.connect(analyser);

        const dataArray: Uint8Array<ArrayBuffer> = new Uint8Array(analyser.frequencyBinCount);
        dataArrayRef.current = dataArray;

        let lastFrameTimestamp = 0;
        const renderSpectrogram = (timestamp: number) => {
          if (!analyserRef.current || !dataArrayRef.current) {
            rafRef.current = requestAnimationFrame(renderSpectrogram);
            return;
          }

          if (timestamp - lastFrameTimestamp >= SPECTROGRAM_FRAME_INTERVAL_MS) {
            analyserRef.current.getByteFrequencyData(dataArrayRef.current);
            const sliceSize = Math.max(
              1,
              Math.floor(dataArrayRef.current.length / SPECTROGRAM_BAR_COUNT),
            );
            const bars: number[] = [];
            for (let i = 0; i < SPECTROGRAM_BAR_COUNT; i += 1) {
              const sliceStart = i * sliceSize;
              let sum = 0;
              let count = 0;
              for (let j = 0; j < sliceSize && sliceStart + j < dataArrayRef.current.length; j += 1) {
                sum += dataArrayRef.current[sliceStart + j];
                count += 1;
              }
              const average = count > 0 ? sum / count : 0;
              bars.push(clamp01(average / 255));
            }
            setSpectrogramData(bars);
            lastFrameTimestamp = timestamp;
          }

          rafRef.current = requestAnimationFrame(renderSpectrogram);
        };

        rafRef.current = requestAnimationFrame(renderSpectrogram);

        const vad = await MicVAD.new({
          stream,
          onSpeechStart: () => setUserSpeaking(true),
          onVADMisfire: () => setUserSpeaking(false),
          onSpeechEnd: (audio) => {
            if (sttReconnectTimerRef.current !== null) {
              window.clearTimeout(sttReconnectTimerRef.current);
              sttReconnectTimerRef.current = null;
            }
            if (ttsReconnectTimerRef.current !== null) {
              window.clearTimeout(ttsReconnectTimerRef.current);
              ttsReconnectTimerRef.current = null;
            }
            reconnectAttemptsRef.current = { stt: 0, tts: 0 };

            setUserSpeaking(false);
            if (
              sttSocketRef.current &&
              sttSocketRef.current.readyState === WebSocket.OPEN &&
              audio.length > 0
            ) {
              const pcm = new Int16Array(audio.length);
              for (let i = 0; i < audio.length; i += 1) {
                const sample = Math.max(-1, Math.min(1, audio[i]));
                pcm[i] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
              }
              try {
                sttSocketRef.current.send(pcm.buffer);
              } catch (error) {
                console.error("Error sending audio frame to STT socket", error);
              }
            }
          },
        });

        if (cancelled) {
          vad.pause();
          if (vad.audioContext && vad.audioContext.state !== "closed") {
            void vad.audioContext.close();
          }
          return;
        }

        micVadRef.current = vad;
        vad.start();
      } catch (error) {
        console.error("Error setting up Live Talk audio pipeline:", error);
        cleanupAudioPipeline();
      }
    };

    initialiseAudioPipeline();

    return () => {
      cancelled = true;
      cleanupAudioPipeline();
    };
  }, [cleanupAudioPipeline, isLiveTalkActive, selectedMicrophone, setUserSpeaking, setSpectrogramData]);

  useEffect(() => {
    if (isLiveTalkActive && sttSocketStatus === "disconnected") {
      const recognition = getBrowserSpeechRecognition();
      if (recognition) {
        browserRecognitionRef.current = recognition;
        recognition.onresult = (event) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (result.isFinal) {
              finalTranscript += result[0].transcript;
            } else {
              interimTranscript += result[0].transcript;
            }
          }

          const combined = (finalTranscript + interimTranscript).trim();
          if (combined) {
            setLiveTranscript(combined);
            upsertPartialTranscript(combined);
            onPartialTranscript(combined);
          } else {
            setLiveTranscript('');
            upsertPartialTranscript('');
          }
          if (finalTranscript) {
            finalizeTranscript(finalTranscript);
            upsertPartialTranscript('');
            setLiveTranscript('');
            onPartialTranscript(finalTranscript);
            onTranscriptReceived(finalTranscript);
          }
        };
        recognition.onstart = () => setUserSpeaking(true);
        recognition.onend = () => setUserSpeaking(false);
        recognition.start();

        return () => {
          recognition.stop();
        };
      }

      console.error("Browser Speech Recognition is not supported.");
    }
  }, [isLiveTalkActive, sttSocketStatus, onPartialTranscript, onTranscriptReceived, setUserSpeaking, setLiveTranscript, upsertPartialTranscript, finalizeTranscript]);

  useEffect(() => {
    if (!isLiveTalkActive || messages.length === 0) {
      return;
    }

    if (!ttsEnabled) {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setAikaSpeaking(false);
      return;
    }

    const lastMessage = messages[messages.length - 1];

    if (
      lastMessage.role === "assistant" &&
      lastMessage.id !== lastSpokenMessageIdRef.current &&
      lastMessage.content
    ) {
      const text = lastMessage.content as string;

      const onStart = () => setAikaSpeaking(true);
      const onEnd = () => {
        setAikaSpeaking(false);
        lastSpokenMessageIdRef.current = lastMessage.id;
      };
      const onError = (error: unknown) => {
        console.error("TTS error:", error);
        setAikaSpeaking(false);
      };

      if (ttsSocketStatus === "connected" && ttsSocketRef.current && ttsEnabled) {
        try {
          ttsSocketRef.current.send(text);
          onStart();
          window.setTimeout(onEnd, 3000);
        } catch (error) {
          console.error("Error sending text to TTS socket:", error);
          browserTextToSpeech(text, selectedVoice, onStart, onEnd, onError);
        }
      } else {
        browserTextToSpeech(text, selectedVoice, onStart, onEnd, onError);
      }
    }
  }, [messages, isLiveTalkActive, setAikaSpeaking, ttsSocketStatus, selectedVoice, ttsEnabled]);
};
































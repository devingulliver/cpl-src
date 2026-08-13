import { useEffect, useMemo, useRef, useState } from 'react';

type Cue = {
  start: number;
  end: number;
  text: string;
};

type AudioViewerProps = {
  audioUrl: string;
  expectedSize: number | null;
  transcriptText: string;
  title: string;
};

function parseTimestamp(value: string) {
  const match = value.trim().match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/);

  if (!match) {
    return 0;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number(match[4]);

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

function formatTimestamp(value: number) {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  const minutes = Math.floor(safeValue / 60);
  const seconds = Math.floor(safeValue % 60);

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function parseTranscript(text: string): Cue[] {
  return text
    .trim()
    .split(/\r?\n\r?\n+/)
    .map((block) => block.split(/\r?\n/).map((line) => line.trimEnd()))
    .flatMap((lines) => {
      if (lines.length < 2) {
        return [];
      }

      const timingLine = lines.find((line) => line.includes('-->'));
      if (!timingLine) {
        return [];
      }

      const [startText, endText] = timingLine.split('-->').map((part) => part.trim().split(' ')[0]);
      const start = parseTimestamp(startText);
      const end = parseTimestamp(endText);
      const textLines = lines
        .filter((line) => line !== timingLine)
        .filter((line) => !/^\d+$/.test(line))
        .filter((line) => line.length > 0);

      if (textLines.length === 0) {
        return [];
      }

      return [{ start, end, text: textLines.join(' ') }];
    });
}

function findCueIndex(cues: Cue[], time: number) {
  if (cues.length === 0) {
    return -1;
  }

  let low = 0;
  let high = cues.length - 1;
  let candidate = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const cue = cues[mid];

    if (time < cue.start) {
      high = mid - 1;
      continue;
    }

    candidate = mid;
    low = mid + 1;
  }

  return candidate;
}

export function AudioViewer({ audioUrl, expectedSize, transcriptText, title }: AudioViewerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const cueRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number | null } | null>(null);
  const [loadedAudioUrl, setLoadedAudioUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pendingSeekRef = useRef<number | null>(null);

  const cues = useMemo(() => parseTranscript(transcriptText), [transcriptText]);
  const activeCueIndex = useMemo(() => findCueIndex(cues, currentTime), [cues, currentTime]);

  useEffect(() => {
    const activeCue = cueRefs.current[activeCueIndex];

    if (activeCue) {
      activeCue.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [activeCueIndex]);

  useEffect(() => {
    let objectUrl: string | null = null;
    const controller = new AbortController();
    setLoadedAudioUrl(null);
    setLoadError(null);
    setLoadProgress({ loaded: 0, total: null });

    const loadAudio = async () => {
      try {
        const response = await fetch(audioUrl, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`Failed to load audio (${response.status})`);
        }

        const totalHeader = response.headers.get('content-length');
        const responseTotal = totalHeader ? Number(totalHeader) : null;
        const total = Number.isFinite(responseTotal) && responseTotal > 0 ? responseTotal : expectedSize;
        const chunks: Uint8Array[] = [];

        if (!response.body) {
          const blob = await response.blob();
          objectUrl = URL.createObjectURL(blob);
          setLoadProgress({ loaded: blob.size, total: blob.size });
          setLoadedAudioUrl(objectUrl);
          return;
        }

        const reader = response.body.getReader();
        let loaded = 0;
        let lastProgressUpdate = 0;

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          if (value) {
            chunks.push(value);
            loaded += value.byteLength;

            const now = performance.now();
            if (now - lastProgressUpdate > 60 || loaded === value.byteLength) {
              setLoadProgress({ loaded, total });
              lastProgressUpdate = now;
            }
          }
        }

        const blob = new Blob(chunks);
        objectUrl = URL.createObjectURL(blob);
        setLoadProgress({ loaded: blob.size, total: total ?? blob.size });
        setLoadedAudioUrl(objectUrl);
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : 'Failed to load audio');
      }
    };

    void loadAudio();

    return () => {
      controller.abort();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [audioUrl, expectedSize]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return undefined;
    }

    const syncCurrentTime = () => {
      const nextTime = audio.currentTime || 0;

      if (pendingSeekRef.current !== null && nextTime === 0 && pendingSeekRef.current > 0) {
        setCurrentTime(pendingSeekRef.current);
        return;
      }

      setCurrentTime(nextTime);

      if (pendingSeekRef.current !== null && Math.abs(nextTime - pendingSeekRef.current) < 0.25) {
        pendingSeekRef.current = null;
      }
    };

    const syncDuration = () => {
      setDuration(audio.duration || 0);
    };

    const stopAnimationFrame = () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    const startAnimationFrame = () => {
      stopAnimationFrame();

      const tick = () => {
        syncCurrentTime();

        if (audio.seeking || !audio.paused) {
          animationFrameRef.current = window.requestAnimationFrame(tick);
          return;
        }

        animationFrameRef.current = null;
      };

      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    const handlePlay = () => {
      startAnimationFrame();
    };

    const handlePause = () => {
      syncCurrentTime();
      stopAnimationFrame();
    };

    const handleSeeking = () => {
      syncCurrentTime();
      startAnimationFrame();
    };

    const handleSeeked = () => {
      syncCurrentTime();

      if (audio.paused) {
        stopAnimationFrame();
      }
    };

    audio.addEventListener('loadedmetadata', syncDuration);
    audio.addEventListener('durationchange', syncDuration);
    audio.addEventListener('timeupdate', syncCurrentTime);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('seeking', handleSeeking);
    audio.addEventListener('seeked', handleSeeked);

    syncCurrentTime();
    syncDuration();

    return () => {
      audio.removeEventListener('loadedmetadata', syncDuration);
      audio.removeEventListener('durationchange', syncDuration);
      audio.removeEventListener('timeupdate', syncCurrentTime);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('seeking', handleSeeking);
      audio.removeEventListener('seeked', handleSeeked);
      stopAnimationFrame();
    };
  }, [loadedAudioUrl]);

  const seekToCue = (start: number) => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    pendingSeekRef.current = start;

    const applySeek = () => {
      audio.currentTime = start;
    };

    if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      applySeek();
    } else {
      const handleReady = () => {
        audio.removeEventListener('loadeddata', handleReady);
        audio.removeEventListener('canplay', handleReady);
        applySeek();
      };

      audio.addEventListener('loadeddata', handleReady);
      audio.addEventListener('canplay', handleReady);
    }

    setCurrentTime(start);
  };

  return (
    <div className="viewer-frame audio-shell">
      <div className="audio-header">
        <div>
          <p className="audio-kicker">Audio viewer</p>
          <h2 className="audio-title">{title}</h2>
        </div>
        <div className="audio-timing" aria-label="Playback time">
          <span>{formatTimestamp(currentTime)}</span>
          <span aria-hidden="true">/</span>
          <span>{formatTimestamp(duration)}</span>
        </div>
      </div>

      <div className="audio-player">
        {loadError ? (
          <p className="audio-missing">{loadError}</p>
        ) : loadedAudioUrl ? (
          <audio
            ref={audioRef}
            controls
            preload="auto"
            src={loadedAudioUrl}
          />
        ) : (
          <div className="audio-missing audio-loading" aria-busy="true" aria-live="polite">
            <div className="audio-loading-copy">
              <span>Loading full audio file before playback...</span>
              <span>
                {loadProgress?.total
                  ? `${Math.round((loadProgress.loaded / loadProgress.total) * 100)}%`
                  : `${Math.max(1, Math.round((loadProgress?.loaded ?? 0) / 1024 / 1024))} MB loaded`}
              </span>
            </div>
            <div className="audio-progress-track" aria-hidden="true">
              <div
                className={`audio-progress-fill ${loadProgress?.total ? '' : 'is-indeterminate'}`}
                style={{
                  width:
                    loadProgress?.total && loadProgress.total > 0
                      ? `${Math.min(100, Math.max(0, (loadProgress.loaded / loadProgress.total) * 100))}%`
                      : '100%',
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="transcript-panel">
        <h3>Transcript</h3>
        {cues.length > 0 ? (
          <div className="transcript-list" aria-label="Transcript synced to audio">
            {cues.map((cue, index) => (
              <button
                key={`${cue.start}-${cue.end}-${index}`}
                ref={(element) => {
                  cueRefs.current[index] = element;
                }}
                aria-current={index === activeCueIndex ? 'true' : undefined}
                className={`transcript-cue ${index === activeCueIndex ? 'is-active' : ''}`}
                disabled={!loadedAudioUrl}
                onClick={() => seekToCue(cue.start)}
                type="button"
              >
                <span className="transcript-time">{formatTimestamp(cue.start)}</span>
                <span className="transcript-text">{cue.text}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="transcript-empty">No transcript was found for this recording.</p>
        )}
      </div>
    </div>
  );
}

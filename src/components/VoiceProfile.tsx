/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Heart,
  Flame,
  Smile,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface VoiceProfileProps {
  userId?: string; // If provided, show that user's voice profile (view mode). If not, show own (record mode)
  onProfileComplete?: () => void;
}

interface VoiceStats {
  total_plays: number;
  unique_listeners: number;
  play_count: number;
  reactions: { reaction_type: string; count: string }[];
}

export default function VoiceProfile({ userId, onProfileComplete }: VoiceProfileProps) {
  const [hasRecording, setHasRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<string | null>(null);
  const [stats, setStats] = useState<VoiceStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  const isViewMode = !!userId;
  const isOwnProfile = !isViewMode;

  useEffect(() => {
    if (isViewMode) {
      fetchVoiceProfile(userId);
    } else {
      fetchMyVoiceProfile();
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [userId]);

  const fetchMyVoiceProfile = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/voice/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      if (data.has_recording) {
        setHasRecording(true);
        setAudioUrl(data.audio_url);
        setDuration(data.duration);
        if (onProfileComplete) onProfileComplete();
      }
    } catch (err) {
      // Silently fail
    }
  };

  const fetchVoiceProfile = async (uid: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/voice/${uid}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      if (data.has_recording) {
        setHasRecording(true);
        setAudioUrl(data.audio_url);
        setDuration(data.duration);
      }
    } catch (err) {
      // Silently fail
    }
  };

  const fetchStats = async (uid: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/voice/stats/${uid}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      if (data.has_recording) {
        setStats(data);
      }
    } catch (err) {
      // Silently fail
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Set up audio analyser for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioData(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setError(null);
      setSuccess(null);

      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 30) {
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);

      // Start visualization
      visualizeAudio();
    } catch (err) {
      setError('Microphone access denied. Please allow microphone access to record.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
  };

  const visualizeAudio = () => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording) return;

      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current!.getByteFrequencyData(dataArray);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;

        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, '#ec4899');
        gradient.addColorStop(1, '#8b5cf6');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  };

  const uploadRecording = async () => {
    if (!audioData) return;

    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/voice/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          audio_data: audioData,
          duration: recordingTime,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to upload recording');
      }

      const data = await response.json();
      setHasRecording(true);
      setAudioUrl(data.audio_url);
      setDuration(data.duration);
      setAudioData(null);
      setSuccess('Voice profile saved! +5% profile completion');
      setTimeout(() => setSuccess(null), 3000);

      if (onProfileComplete) onProfileComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload recording');
    } finally {
      setLoading(false);
    }
  };

  const deleteRecording = async () => {
    const token = localStorage.getItem('token');
    try {
      await fetch('/api/voice/me', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      setHasRecording(false);
      setAudioUrl(null);
      setDuration(0);
      setSuccess('Voice profile deleted');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to delete recording');
    }
  };

  const playAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    } else if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audioRef.current = audio;
      audio.play();
      setIsPlaying(true);
    }
  };

  const recordAgain = () => {
    setAudioData(null);
    setRecordingTime(0);
    startRecording();
  };

  const reactToVoice = async (reactionType: string) => {
    if (!userId) return;

    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/voice/react/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reaction_type: reactionType }),
      });

      setSuccess('Reaction sent!');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      // Silently fail
    }
  };

  const getReactionIcon = (type: string) => {
    switch (type) {
      case 'heart': return <Heart className="w-5 h-5" />;
      case 'fire': return <Flame className="w-5 h-5" />;
      case 'laugh': return <Smile className="w-5 h-5" />;
      case 'thoughtful': return <Lightbulb className="w-5 h-5" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl">
            <Mic className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Voice Profile</h2>
            <p className="text-gray-400 text-sm">
              {isOwnProfile
                ? 'Let your personality shine with a 30-second audio intro'
                : 'Listen to their authentic voice intro'}
            </p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-green-300 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Recording Mode (Own Profile) */}
      {isOwnProfile && !hasRecording && !audioData && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
          <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-pink-500/20 to-purple-600/20 rounded-full flex items-center justify-center">
            <Mic className="w-12 h-12 text-pink-500" />
          </div>

          <h3 className="text-xl font-bold mb-2">Record Your Voice Intro</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Share up to 30 seconds of your authentic self. No editing, no filters - just you.
            This helps others connect with your personality.
          </p>

          <div className="flex justify-center gap-4">
            <button
              onClick={startRecording}
              disabled={isRecording}
              className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 rounded-lg transition flex items-center gap-2"
            >
              <Mic className="w-5 h-5" />
              Start Recording
            </button>
          </div>

          <div className="mt-4 text-sm text-gray-500">
            <p>🎙️ Speak naturally about who you are and what you're looking for</p>
            <p>⏱️ Maximum 30 seconds</p>
            <p>✨ +5% profile completion bonus</p>
          </div>
        </div>
      )}

      {/* Recording Interface */}
      {isOwnProfile && isRecording && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
          <canvas
            ref={canvasRef}
            width={400}
            height={100}
            className="mx-auto mb-6 rounded-lg"
          />

          <div className="text-4xl font-bold mb-2">
            {recordingTime}s / 30s
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={stopRecording}
              className="px-8 py-4 bg-red-500 hover:bg-red-600 rounded-lg transition flex items-center gap-2 text-lg"
            >
              <MicOff className="w-6 h-6" />
              Stop Recording
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-red-400">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            Recording...
          </div>
        </div>
      )}

      {/* Preview Interface */}
      {isOwnProfile && audioData && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>

          <h3 className="text-xl font-bold mb-2">Recording Complete!</h3>
          <p className="text-gray-400 mb-6">
            Duration: {recordingTime} seconds
          </p>

          <div className="flex justify-center gap-3">
            <button
              onClick={recordAgain}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition flex items-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Record Again
            </button>
            <button
              onClick={uploadRecording}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 rounded-lg transition flex items-center gap-2"
            >
              {loading ? (
                <>Saving...</>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Save Voice Profile
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Playback Interface (Own Profile) */}
      {isOwnProfile && hasRecording && audioUrl && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Mic className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">Your Voice Intro</h3>
                <p className="text-sm text-gray-400">{duration} seconds</p>
              </div>
            </div>

            <button
              onClick={() => {
                if (confirm('Delete your voice profile?')) {
                  deleteRecording();
                }
              }}
              className="p-2 hover:bg-white/10 rounded-lg transition text-red-400"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={playAudio}
            className="w-full px-6 py-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 rounded-lg transition flex items-center justify-center gap-2"
          >
            {isPlaying ? (
              <>
                <Pause className="w-5 h-5" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Play Your Recording
              </>
            )}
          </button>
        </div>
      )}

      {/* Playback Interface (View Mode) */}
      {isViewMode && hasRecording && audioUrl && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Mic className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">Voice Intro</h3>
              <p className="text-sm text-gray-400">{duration} seconds</p>
            </div>
          </div>

          <button
            onClick={playAudio}
            className="w-full px-6 py-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 rounded-lg transition flex items-center justify-center gap-2 mb-4"
          >
            {isPlaying ? (
              <>
                <Pause className="w-5 h-5" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Listen to Voice Intro
              </>
            )}
          </button>

          {/* Reactions */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-gray-400">React to their voice</h4>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => reactToVoice('heart')}
                className="p-3 bg-white/5 hover:bg-red-500/20 rounded-lg transition hover:scale-110"
              >
                <Heart className="w-6 h-6 text-red-400" />
              </button>
              <button
                onClick={() => reactToVoice('fire')}
                className="p-3 bg-white/5 hover:bg-orange-500/20 rounded-lg transition hover:scale-110"
              >
                <Flame className="w-6 h-6 text-orange-400" />
              </button>
              <button
                onClick={() => reactToVoice('laugh')}
                className="p-3 bg-white/5 hover:bg-yellow-500/20 rounded-lg transition hover:scale-110"
              >
                <Smile className="w-6 h-6 text-yellow-400" />
              </button>
              <button
                onClick={() => reactToVoice('thoughtful')}
                className="p-3 bg-white/5 hover:bg-blue-500/20 rounded-lg transition hover:scale-110"
              >
                <Lightbulb className="w-6 h-6 text-blue-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Voice Profile (View Mode) */}
      {isViewMode && !hasRecording && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-white/5 rounded-full flex items-center justify-center">
            <MicOff className="w-10 h-10 text-gray-600" />
          </div>
          <h3 className="text-xl font-bold mb-2">No Voice Intro Yet</h3>
          <p className="text-gray-400">
            This user hasn't recorded a voice profile yet.
          </p>
        </div>
      )}

      {/* Stats Toggle (View Mode) */}
      {isViewMode && hasRecording && (
        <div className="text-center">
          <button
            onClick={() => {
              if (showStats) {
                setShowStats(false);
                setStats(null);
              } else {
                fetchStats(userId);
                setShowStats(true);
              }
            }}
            className="text-sm text-gray-400 hover:text-white transition"
          >
            {showStats ? 'Hide Stats' : 'View Stats'}
          </button>
        </div>
      )}

      {/* Stats Display */}
      {showStats && stats && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Voice Profile Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-500">{stats.total_plays}</div>
              <div className="text-sm text-gray-400">Total Plays</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-500">{stats.unique_listeners}</div>
              <div className="text-sm text-gray-400">Unique Listeners</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">{stats.play_count}</div>
              <div className="text-sm text-gray-400">This Week</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">
                {stats.reactions?.reduce((sum, r) => sum + parseInt(r.count), 0) || 0}
              </div>
              <div className="text-sm text-gray-400">Reactions</div>
            </div>
          </div>

          {stats.reactions && stats.reactions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <h4 className="text-sm font-medium mb-2 text-gray-400">Top Reactions</h4>
              <div className="flex gap-2">
                {stats.reactions.map((reaction) => (
                  <div key={reaction.reaction_type} className="flex items-center gap-1 px-3 py-1 bg-white/5 rounded-full">
                    {getReactionIcon(reaction.reaction_type)}
                    <span className="text-sm">{reaction.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

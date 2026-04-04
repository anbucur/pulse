/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  CheckCircle,
  XCircle,
  Shield,
  ShieldAlert,
  RefreshCw,
  User,
  Badge,
  Star,
  Award,
  Eye,
  EyeOff,
  Clock,
  AlertCircle,
  CameraOff
} from 'lucide-react';

interface VerificationStatus {
  verified: boolean;
  status: string;
  badgeType?: string;
  verificationCount?: number;
  consecutiveVerifications?: number;
  displayOnProfile?: boolean;
  lastVerifiedAt?: string;
  expiresAt?: string;
  attemptCount?: number;
  isExpired?: boolean;
}

interface VerificationHistory {
  id: string;
  status: string;
  comparison_score?: number;
  created_at: string;
  verified_at?: string;
  rejection_reason?: string;
}

export default function PhotoVerification() {
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [history, setHistory] = useState<VerificationHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetchStatus();
    fetchHistory();
  }, []);

  const fetchStatus = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/verification/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  };

  const fetchHistory = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/verification/history?limit=10', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access not supported on this device');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 640 },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (err) {
      setCameraError('Could not access camera. Please grant camera permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
    setCapturedImage(null);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageData);

    // Stop camera after capture
    stopCamera();
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const submitVerification = async () => {
    if (!capturedImage) return;

    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/verification/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ live_photo: capturedImage })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.verified) {
          await fetchStatus();
          await fetchHistory();
          setCapturedImage(null);
        } else {
          setError(data.reason || 'Verification failed. Please try again.');
        }
      } else {
        const data = await response.json();
        setError(data.error || 'Verification failed');
      }
    } catch (err) {
      setError('Failed to submit verification');
    } finally {
      setLoading(false);
    }
  };

  const reverify = async () => {
    if (!capturedImage) return;

    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/verification/reverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ live_photo: capturedImage })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.verified) {
          await fetchStatus();
          await fetchHistory();
          setCapturedImage(null);
        } else {
          setError('Re-verification failed. Please try again.');
        }
      } else {
        setError('Re-verification failed');
      }
    } catch (err) {
      setError('Failed to re-verify');
    } finally {
      setLoading(false);
    }
  };

  const toggleBadgeVisibility = async () => {
    const token = localStorage.getItem('token');
    try {
      await fetch('/api/verification/badge/visibility', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ display_on_profile: !status?.displayOnProfile })
      });
      await fetchStatus();
    } catch (err) {
      setError('Failed to update badge visibility');
    }
  };

  const getBadgeIcon = () => {
    switch (status?.badgeType) {
      case 'super_verified':
        return <Award className="w-6 h-6 text-purple-400" />;
      case 'verified_plus':
        return <Star className="w-6 h-6 text-blue-400" />;
      default:
        return <Shield className="w-6 h-6 text-green-400" />;
    }
  };

  const getBadgeText = () => {
    switch (status?.badgeType) {
      case 'super_verified':
        return 'Super Verified';
      case 'verified_plus':
        return 'Verified+';
      default:
        return 'Verified';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <User className="w-6 h-6 text-pink-500" />
              Photo Verification
            </h2>
            <p className="text-gray-400 mt-1">
              Prove you're real with FaceCheck
            </p>
          </div>
          {status?.verified && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              History
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Camera Error */}
      {cameraError && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 text-yellow-300 flex items-center gap-2">
          <CameraOff className="w-5 h-5" />
          {cameraError}
        </div>
      )}

      {/* Verification Status */}
      {status?.verified && (
        <div className="bg-green-500/20 border-2 border-green-500 rounded-2xl p-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              {getBadgeIcon()}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-green-400 flex items-center justify-center gap-2">
                {getBadgeText()}
                <CheckCircle className="w-6 h-6" />
              </h3>
              <p className="text-gray-300 mt-2">
                Your profile is verified with a {getBadgeText().toLowerCase()} badge
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-2xl font-bold text-pink-400">{status.verificationCount}</div>
                <div className="text-sm text-gray-400">Total Verifications</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-400">{status.consecutiveVerifications}</div>
                <div className="text-sm text-gray-400">Consecutive</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-400">
                  {status.displayOnProfile ? 'Visible' : 'Hidden'}
                </div>
                <div className="text-sm text-gray-400">Badge Status</div>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={toggleBadgeVisibility}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition flex items-center gap-2"
              >
                {status.displayOnProfile ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                {status.displayOnProfile ? 'Hide Badge' : 'Show Badge'}
              </button>
              <button
                onClick={() => { setCapturedImage(null); startCamera(); }}
                className="px-6 py-3 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Re-verify
              </button>
            </div>

            {status.lastVerifiedAt && (
              <p className="text-sm text-gray-400">
                Last verified: {new Date(status.lastVerifiedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Verification Needed */}
      {!status?.verified && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
          {!showCamera && !capturedImage && (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center">
                  <Camera className="w-16 h-16 text-gray-400" />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2">Verify Your Profile</h3>
              <p className="text-gray-400 mb-6">
                Take a live selfie to prove you're real and get your verification badge
              </p>
              {status?.attemptCount && status.attemptCount > 0 && (
                <p className="text-yellow-400 mb-4">
                  Attempts today: {status.attemptCount}/5
                </p>
              )}
              <button
                onClick={startCamera}
                className="px-8 py-4 bg-pink-500 hover:bg-pink-600 rounded-xl transition flex items-center gap-2 mx-auto"
              >
                <Camera className="w-5 h-5" />
                Start Verification
              </button>
            </>
          )}

          {/* Camera View */}
          {showCamera && (
            <div className="space-y-4">
              <div className="relative inline-block">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-80 h-80 object-cover rounded-2xl bg-black"
                />
                <div className="absolute inset-0 border-4 border-pink-500/50 rounded-2xl pointer-events-none" />
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-pink-500/80 px-4 py-2 rounded-full text-sm font-semibold">
                  Position your face in the frame
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  onClick={capturePhoto}
                  className="px-6 py-3 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Capture Photo
                </button>
                <button
                  onClick={stopCamera}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>

              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {/* Captured Image Preview */}
          {capturedImage && (
            <div className="space-y-4">
              <div className="relative inline-block">
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-80 h-80 object-cover rounded-2xl"
                />
                <div className="absolute top-4 right-4 bg-green-500 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Captured
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  onClick={retakePhoto}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition flex items-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Retake
                </button>
                <button
                  onClick={status?.verified ? reverify : submitVerification}
                  disabled={loading}
                  className="px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:from-gray-700 disabled:to-gray-800 rounded-lg transition flex items-center gap-2"
                >
                  {loading ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      {status?.verified ? 'Re-verify' : 'Submit Verification'}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {showHistory && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Verification History
          </h3>

          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No verification history yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="bg-white/5 rounded-lg p-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    {item.status === 'verified' ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <div className="font-semibold capitalize">{item.status}</div>
                      <div className="text-sm text-gray-400">
                        {new Date(item.created_at).toLocaleString()}
                      </div>
                      {item.comparison_score && (
                        <div className="text-sm text-gray-400">
                          Match: {item.comparison_score.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                  {item.rejection_reason && (
                    <div className="text-sm text-red-400">{item.rejection_reason}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Users,
  Target,
  Shield,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Clock,
  AlertTriangle,
  Calendar,
  Send,
  Play,
  Eye,
  EyeOff,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  display_order: number;
}

interface Question {
  id: string;
  category_id: string;
  category_name: string;
  category_icon: string;
  question_text: string;
  question_type: string;
  options: string[];
  allows_multiple: boolean;
  requires_explanation: boolean;
  display_order: number;
}

interface Session {
  id: string;
  initiated_by: string;
  with_user_id: string;
  status: string;
  phase: string;
  user1_completed: boolean;
  user2_completed: boolean;
  match_score?: number;
  highlighted_matches?: string[];
  potential_gaps?: string[];
  scheduled_meeting_at?: string;
  meeting_notes?: string;
  initiated_by_name?: string;
  with_user_name?: string;
}

interface SessionDetail extends Session {
  answers?: {
    [categoryName: string]: {
      user1_answers: Answer[];
      user2_answers: Answer[];
    };
  };
}

interface Answer {
  question_id: string;
  question_text: string;
  question_type: string;
  answer: any;
  explanation?: string;
}

interface NegotiationPlaygroundProps {
  targetUserId?: string;
  targetUserName?: string;
}

export default function NegotiationPlayground({ targetUserId, targetUserName }: NegotiationPlaygroundProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'play' | 'results'>('list');
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCategories();
    fetchQuestions();
    fetchSessions();
  }, []);

  const fetchCategories = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/negotiation/categories', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }

      const data = await response.json();
      setCategories(data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchQuestions = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/negotiation/questions', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }

      const data = await response.json();
      setQuestions(data);
    } catch (err) {
      console.error('Error fetching questions:', err);
    }
  };

  const fetchSessions = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/negotiation/sessions', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }

      const data = await response.json();
      setSessions(data);
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  };

  const createSession = async (withUserId: string) => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/negotiation/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ with_user_id: withUserId }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const session = await response.json();
      setSelectedSession(session);
      setCurrentView('play');
      await fetchSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswers = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    const answerArray = Object.entries(answers).map(([questionId, answer]) => ({
      question_id: questionId,
      answer,
      explanation: explanations[questionId],
    }));

    try {
      const response = await fetch(`/api/negotiation/sessions/${selectedSession?.id}/answers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ answers: answerArray }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit answers');
      }

      // Fetch updated session
      await fetchSessionDetails(selectedSession!.id);
      setCurrentView('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionDetails = async (sessionId: string) => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/negotiation/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch session details');
      }

      const data = await response.json();
      setSelectedSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const scheduleMeeting = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/negotiation/sessions/${selectedSession?.id}/schedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          scheduled_meeting_at: new Date().toISOString(),
          meeting_notes: 'Scheduled through Negotiation Playground',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to schedule meeting');
      }

      await fetchSessionDetails(selectedSession!.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getQuestionsByCategory = () => {
    const grouped: Record<string, Question[]> = {};
    questions.forEach((q) => {
      if (!grouped[q.category_name]) {
        grouped[q.category_name] = [];
      }
      grouped[q.category_name].push(q);
    });
    return grouped;
  };

  const getCategoryIcon = (iconName: string) => {
    const icons: Record<string, any> = {
      'message-circle': MessageCircle,
      heart: Heart,
      users: Users,
      target: Target,
      shield: Shield,
      sparkles: Sparkles,
    };
    return icons[iconName] || Sparkles;
  };

  const getCurrentQuestion = () => {
    const grouped = getQuestionsByCategory();
    const categories = Object.keys(grouped);
    if (categories.length === 0) return null;

    const currentCategory = categories[currentCategoryIndex];
    const categoryQuestions = grouped[currentCategory];
    return categoryQuestions[currentQuestionIndex];
  };

  const getTotalQuestions = () => {
    return questions.length;
  };

  const getCurrentProgress = () => {
    const grouped = getQuestionsByCategory();
    const categories = Object.keys(grouped);
    let progress = 0;

    for (let i = 0; i < currentCategoryIndex; i++) {
      progress += grouped[categories[i]].length;
    }
    progress += currentQuestionIndex + 1;

    return progress;
  };

  const handleAnswer = (questionId: string, answer: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleExplanation = (questionId: string, explanation: string) => {
    setExplanations((prev) => ({ ...prev, [questionId]: explanation }));
  };

  const nextQuestion = () => {
    const grouped = getQuestionsByCategory();
    const categories = Object.keys(grouped);
    const currentCategory = categories[currentCategoryIndex];
    const categoryQuestions = grouped[currentCategory];

    if (currentQuestionIndex < categoryQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else if (currentCategoryIndex < categories.length - 1) {
      setCurrentCategoryIndex(currentCategoryIndex + 1);
      setCurrentQuestionIndex(0);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (currentCategoryIndex > 0) {
      setCurrentCategoryIndex(currentCategoryIndex - 1);
      const grouped = getQuestionsByCategory();
      const categories = Object.keys(grouped);
      setCurrentQuestionIndex(grouped[categories[currentCategoryIndex - 1]].length - 1);
    }
  };

  const renderQuestionCard = () => {
    const question = getCurrentQuestion();
    if (!question) return null;

    const Icon = getCategoryIcon(question.category_icon);
    const currentAnswer = answers[question.id];

    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>
              {question.category_name} - Question {currentQuestionIndex + 1} of{' '}
              {getQuestionsByCategory()[question.category_name]?.length}
            </span>
            <span>
              Overall: {getCurrentProgress()} of {getTotalQuestions()}
            </span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all"
              style={{ width: `${(getCurrentProgress() / getTotalQuestions()) * 100}%` }}
            />
          </div>
        </div>

        {/* Category */}
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-5 h-5 text-pink-500" />
          <span className="text-sm text-gray-400">{question.category_name}</span>
        </div>

        {/* Question */}
        <h3 className="text-xl font-bold mb-6">{question.question_text}</h3>

        {/* Options */}
        {question.question_type === 'single_choice' && (
          <div className="space-y-3">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswer(question.id, option)}
                className={`w-full p-4 rounded-lg text-left transition ${
                  currentAnswer === option
                    ? 'bg-pink-500 border-2 border-pink-500'
                    : 'bg-white/5 border-2 border-white/10 hover:border-pink-500/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      currentAnswer === option
                        ? 'border-white bg-white'
                        : 'border-gray-400'
                    }`}
                  >
                    {currentAnswer === option && <Check className="w-3 h-3 text-pink-500" />}
                  </div>
                  <span>{option}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {question.question_type === 'multiple_choice' && (
          <div className="space-y-3">
            {question.options.map((option, index) => {
              const isSelected = Array.isArray(currentAnswer) && currentAnswer.includes(option);
              return (
                <button
                  key={index}
                  onClick={() => {
                    const current = Array.isArray(currentAnswer) ? currentAnswer : [];
                    const updated = isSelected
                      ? current.filter((a) => a !== option)
                      : [...current, option];
                    handleAnswer(question.id, updated);
                  }}
                  className={`w-full p-4 rounded-lg text-left transition ${
                    isSelected
                      ? 'bg-pink-500 border-2 border-pink-500'
                      : 'bg-white/5 border-2 border-white/10 hover:border-pink-500/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected ? 'border-white bg-white' : 'border-gray-400'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-pink-500" />}
                    </div>
                    <span>{option}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Explanation */}
        {question.requires_explanation && (
          <div className="mt-6">
            <label className="block text-sm font-medium mb-2">
              Add an explanation (optional)
            </label>
            <textarea
              value={explanations[question.id] || ''}
              onChange={(e) => handleExplanation(question.id, e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none resize-none"
              rows={3}
              placeholder="Share more about your answer..."
            />
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={previousQuestion}
            disabled={currentCategoryIndex === 0 && currentQuestionIndex === 0}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-50 rounded-lg transition flex items-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>

          {getCurrentProgress() === getTotalQuestions() ? (
            <button
              onClick={submitAnswers}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 disabled:opacity-50 rounded-lg transition flex items-center gap-2"
            >
              {loading ? (
                'Submitting...'
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Answers
                </>
              )}
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              className="px-6 py-3 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (!selectedSession) return null;

    const isComplete = selectedSession.user1_completed && selectedSession.user2_completed;
    const userAnswers = selectedSession.answers || {};

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Target className="w-6 h-6 text-pink-500" />
                Negotiation Results
              </h2>
              <p className="text-gray-400 mt-1">
                Comparing preferences with {selectedSession.with_user_name}
              </p>
            </div>
            <button
              onClick={() => setCurrentView('list')}
              className="p-2 hover:bg-white/10 rounded-lg transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {!isComplete ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
            <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Waiting for Partner</h3>
            <p className="text-gray-400">
              Your partner hasn't completed their answers yet. We'll notify you when they're done!
            </p>
          </div>
        ) : (
          <>
            {/* Match Score */}
            {selectedSession.match_score !== undefined && (
              <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/50 rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-pink-500" />
                      Compatibility Score
                    </h3>
                    <p className="text-gray-400 mt-1">Based on your answers</p>
                  </div>
                  <div className="text-5xl font-bold text-pink-500">
                    {selectedSession.match_score}%
                  </div>
                </div>
              </div>
            )}

            {/* Categories Comparison */}
            <div className="space-y-4">
              {Object.entries(userAnswers).map(([categoryName, categoryData]: [string, any]) => {
                const Icon = getCategoryIcon(
                  categories.find((c) => c.name === categoryName)?.icon || 'sparkles'
                );

                return (
                  <div key={categoryName} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Icon className="w-5 h-5 text-pink-500" />
                        {categoryName}
                      </h3>
                      <button
                        onClick={() => {
                          const newRevealed = new Set(revealedAnswers);
                          if (newRevealed.has(categoryName)) {
                            newRevealed.delete(categoryName);
                          } else {
                            newRevealed.add(categoryName);
                          }
                          setRevealedAnswers(newRevealed);
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg transition"
                      >
                        {revealedAnswers.has(categoryName) ? (
                          <EyeOff className="w-5 h-5 text-gray-400" />
                        ) : (
                          <Eye className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </div>

                    {revealedAnswers.has(categoryName) ? (
                      <div className="space-y-4">
                        {categoryData.user1_answers.map((answer: Answer, index: number) => {
                          const user2Answer = categoryData.user2_answers[index];
                          const isMatch = JSON.stringify(answer.answer) === JSON.stringify(user2Answer.answer);

                          return (
                            <div key={answer.question_id} className="space-y-3">
                              <p className="text-sm font-medium text-gray-300">
                                {answer.question_text}
                              </p>

                              <div className="grid md:grid-cols-2 gap-4">
                                <div
                                  className={`p-3 rounded-lg ${
                                    isMatch
                                      ? 'bg-green-500/20 border border-green-500/50'
                                      : 'bg-white/5 border border-white/10'
                                  }`}
                                >
                                  <p className="text-xs text-gray-400 mb-1">Your answer</p>
                                  <p className="text-sm">
                                    {Array.isArray(answer.answer)
                                      ? answer.answer.join(', ')
                                      : String(answer.answer)}
                                  </p>
                                  {answer.explanation && (
                                    <p className="text-xs text-gray-400 mt-2 italic">
                                      "{answer.explanation}"
                                    </p>
                                  )}
                                </div>

                                <div
                                  className={`p-3 rounded-lg ${
                                    isMatch
                                      ? 'bg-green-500/20 border border-green-500/50'
                                      : 'bg-yellow-500/20 border border-yellow-500/50'
                                  }`}
                                >
                                  <p className="text-xs text-gray-400 mb-1">
                                    {selectedSession.with_user_name}'s answer
                                  </p>
                                  <p className="text-sm">
                                    {Array.isArray(user2Answer.answer)
                                      ? user2Answer.answer.join(', ')
                                      : String(user2Answer.answer)}
                                  </p>
                                  {user2Answer.explanation && (
                                    <p className="text-xs text-gray-400 mt-2 italic">
                                      "{user2Answer.explanation}"
                                    </p>
                                  )}
                                </div>
                              </div>

                              {isMatch && (
                                <div className="flex items-center gap-2 text-green-400 text-sm">
                                  <Check className="w-4 h-4" />
                                  <span>Perfect match!</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm">Click the eye icon to reveal answers</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {selectedSession.status !== 'scheduled' ? (
                <button
                  onClick={scheduleMeeting}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 disabled:opacity-50 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Calendar className="w-5 h-5" />
                  Schedule Meeting
                </button>
              ) : (
                <div className="flex-1 px-6 py-3 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center justify-center gap-2">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-green-400">Meeting Scheduled!</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderSessionList = () => {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="w-6 h-6 text-pink-500" />
            Negotiation Playground
          </h2>
          <p className="text-gray-400 mt-1">
            Interactive card game questionnaire to understand compatibility before meeting
          </p>
        </div>

        {/* Start New Session Button */}
        {targetUserId && (
          <button
            onClick={() => createSession(targetUserId)}
            disabled={loading}
            className="w-full px-6 py-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 disabled:opacity-50 rounded-xl transition flex items-center justify-center gap-3"
          >
            <Play className="w-6 h-6" />
            Start Negotiation with {targetUserName || 'this user'}
          </button>
        )}

        {/* Sessions List */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Your Negotiations</h3>

          {sessions.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
              <Target className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No negotiations yet. Start one to see compatibility!</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className="bg-white/10 backdrop-blur-lg rounded-xl p-4 hover:bg-white/15 transition cursor-pointer"
                onClick={() => {
                  setSelectedSession(session);
                  if (session.user1_completed && session.user2_completed) {
                    setCurrentView('results');
                    fetchSessionDetails(session.id);
                  } else {
                    setCurrentView('play');
                  }
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold">
                      Negotiation with {session.with_user_name || session.initiated_by_name}
                    </h4>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        {session.user1_completed ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-400" />
                        )}
                        <span>You</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {session.user2_completed ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-400" />
                        )}
                        <span>Them</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    {session.match_score !== undefined && (
                      <div className="text-2xl font-bold text-pink-500">{session.match_score}%</div>
                    )}
                    <div className="text-xs text-gray-400 capitalize">{session.status}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300 mb-4">
          {error}
        </div>
      )}

      {currentView === 'list' && renderSessionList()}
      {currentView === 'play' && renderQuestionCard()}
      {currentView === 'results' && renderResults()}
    </div>
  );
}

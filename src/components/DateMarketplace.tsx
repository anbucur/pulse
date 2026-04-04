/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  MapPin,
  Calendar,
  Clock,
  Users,
  DollarSign,
  Star,
  Heart,
  ChevronDown,
  X,
  Check,
  ArrowRight,
  Utensils,
  Wine,
  Music,
  Coffee,
  Sparkles,
  TrendingUp,
  Award,
  MessageSquare,
  ThumbsUp,
} from 'lucide-react';

interface DatePackage {
  id: string;
  title: string;
  description: string;
  tagline: string;
  package_type: string;
  vibe: string[];
  base_price: number;
  price_per_person: boolean;
  min_party_size: number;
  max_party_size: number;
  duration_hours: number;
  duration_text: string;
  inclusions: string[];
  dietary_accommodations: string[];
  photos: string[];
  tags: string[];
  good_for: string[];
  popularity_score: number;
  booking_count: number;
  avg_review_rating: number;
  review_count: number;
  venue_name: string;
  venue_address: string;
  venue_city: string;
  venue_state: string;
  venue_photos: string[];
  venue_rating: number;
  ambiance: string[];
  match_score?: number;
  dietary_match?: boolean;
  interests_match?: boolean;
}

interface Booking {
  id: string;
  confirmation_code: string;
  booking_date: string;
  booking_time: string;
  party_size: number;
  total_price: number;
  booking_status: string;
  package_title: string;
  venue_name: string;
  venue_address: string;
}

export default function DateMarketplace() {
  const [packages, setPackages] = useState<DatePackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<DatePackage | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedVibe, setSelectedVibe] = useState('');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [sortBy, setSortBy] = useState('popularity');

  // Booking modal
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingData, setBookingData] = useState({
    date: '',
    time: '',
    partySize: 2,
    specialRequests: '',
    dietaryRestrictions: '',
    occasion: '',
  });

  // Reviews modal
  const [showReviewsModal, setShowReviewsModal] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'browse' | 'bookings'>('browse');

  useEffect(() => {
    if (activeTab === 'browse') {
      fetchPackages();
    } else {
      fetchBookings();
    }
  }, [activeTab, sortBy]);

  const fetchPackages = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedType) params.append('package_type', selectedType);
      if (selectedVibe) params.append('vibe', selectedVibe);
      if (priceRange.min) params.append('min_price', priceRange.min);
      if (priceRange.max) params.append('max_price', priceRange.max);
      params.append('sort_by', sortBy);

      const response = await fetch(`/api/marketplace/packages?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch packages');
      }

      const data = await response.json();
      setPackages(data.packages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/marketplace/bookings?upcoming=true', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }

      const data = await response.json();
      setBookings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const createBooking = async () => {
    if (!selectedPackage || !bookingData.date || !bookingData.time) {
      setError('Please select date and time');
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/marketplace/packages/${selectedPackage.id}/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          booking_date: bookingData.date,
          booking_time: bookingData.time,
          party_size: bookingData.partySize,
          special_requests: bookingData.specialRequests || null,
          dietary_restrictions: bookingData.dietaryRestrictions || null,
          occasion: bookingData.occasion || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create booking');
      }

      const data = await response.json();
      setShowBookingModal(false);
      setActiveTab('bookings');
      await fetchBookings();

      // Show success message
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book package');
    }
  };

  const cancelBooking = async (bookingId: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/marketplace/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: 'Changed plans' }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel booking');
      }

      await fetchBookings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel booking');
    }
  };

  const getPackageIcon = (type: string) => {
    const icons: Record<string, JSX.Element> = {
      dinner: <Utensils className="w-5 h-5" />,
      drinks: <Wine className="w-5 h-5" />,
      entertainment: <Music className="w-5 h-5" />,
      coffee: <Coffee className="w-5 h-5" />,
      adventure: <Sparkles className="w-5 h-5" />,
    };
    return icons[type] || <Heart className="w-5 h-5" />;
  };

  const getPackageColor = (type: string) => {
    const colors: Record<string, string> = {
      dinner: 'bg-orange-500',
      drinks: 'bg-purple-500',
      entertainment: 'bg-pink-500',
      coffee: 'bg-amber-500',
      adventure: 'bg-blue-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-pink-500" />
              Date Marketplace
            </h2>
            <p className="text-gray-400 mt-1">
              Discover curated date experiences from top venues
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-6 py-2 rounded-lg transition ${
              activeTab === 'browse'
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            Browse Packages
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-6 py-2 rounded-lg transition ${
              activeTab === 'bookings'
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            My Bookings
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {activeTab === 'browse' && (
        <>
          {/* Filters */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                    placeholder="Search packages..."
                  />
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                >
                  <option value="">All Types</option>
                  <option value="dinner">Dinner</option>
                  <option value="drinks">Drinks</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="coffee">Coffee</option>
                  <option value="adventure">Adventure</option>
                </select>
              </div>

              {/* Vibe */}
              <div>
                <label className="block text-sm font-medium mb-1">Vibe</label>
                <select
                  value={selectedVibe}
                  onChange={(e) => setSelectedVibe(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                >
                  <option value="">Any Vibe</option>
                  <option value="romantic">Romantic</option>
                  <option value="casual">Casual</option>
                  <option value="adventurous">Adventurous</option>
                  <option value="intimate">Intimate</option>
                  <option value="fun">Fun</option>
                </select>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium mb-1">Price Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={priceRange.min}
                    onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                    className="w-1/2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                    placeholder="Min"
                  />
                  <input
                    type="number"
                    value={priceRange.max}
                    onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                    className="w-1/2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                    placeholder="Max"
                  />
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium mb-1">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                >
                  <option value="popularity">Popularity</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                  <option value="newest">Newest</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={fetchPackages}
                className="px-6 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedType('');
                  setSelectedVibe('');
                  setPriceRange({ min: '', max: '' });
                }}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Packages List */}
          {loading ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent"></div>
              <p className="mt-4 text-gray-400">Loading packages...</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden hover:ring-2 hover:ring-pink-500 transition cursor-pointer"
                  onClick={() => setSelectedPackage(pkg)}
                >
                  {/* Photo */}
                  {pkg.photos && pkg.photos.length > 0 && (
                    <div className="relative h-48">
                      <img
                        src={pkg.photos[0]}
                        alt={pkg.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 left-3 flex gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPackageColor(pkg.package_type)}`}>
                          {pkg.package_type}
                        </span>
                      </div>
                      {pkg.match_score && pkg.match_score > 0 && (
                        <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                          {pkg.match_score} matches
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-4">
                    {/* Venue */}
                    <div className="flex items-center gap-1 text-gray-400 text-sm mb-2">
                      <MapPin className="w-4 h-4" />
                      {pkg.venue_name}
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold mb-2">{pkg.title}</h3>
                    {pkg.tagline && (
                      <p className="text-gray-400 text-sm mb-3">{pkg.tagline}</p>
                    )}

                    {/* Vibe */}
                    {pkg.vibe && pkg.vibe.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {pkg.vibe.slice(0, 3).map((v, i) => (
                          <span key={i} className="px-2 py-1 bg-pink-500/20 text-pink-300 rounded text-xs">
                            {v}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500" />
                        {pkg.avg_review_rating.toFixed(1)}
                        <span className="text-xs">({pkg.review_count})</span>
                      </div>
                      {pkg.duration_text && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {pkg.duration_text}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {pkg.min_party_size}-{pkg.max_party_size}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xl font-bold text-pink-500">
                        <DollarSign className="w-5 h-5" />
                        {pkg.base_price.toFixed(0)}
                        {pkg.price_per_person && <span className="text-sm text-gray-400">/person</span>}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPackage(pkg);
                          setShowBookingModal(true);
                        }}
                        className="px-4 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition"
                      >
                        Book Now
                      </button>
                    </div>

                    {/* Match indicators */}
                    {pkg.dietary_match && (
                      <div className="mt-3 text-xs text-green-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Matches your dietary preferences
                      </div>
                    )}
                    {pkg.interests_match && (
                      <div className="mt-1 text-xs text-blue-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Matches your interests
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {packages.length === 0 && !loading && (
                <div className="col-span-full bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
                  <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No packages found. Try adjusting your filters.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'bookings' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent"></div>
              <p className="mt-4 text-gray-400">Loading bookings...</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No upcoming bookings. Browse packages to book your first date!</p>
            </div>
          ) : (
            bookings.map((booking) => (
              <div key={booking.id} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500">
                        {booking.booking_status}
                      </span>
                      <span className="text-gray-400 text-sm">
                        Confirmation: {booking.confirmation_code}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold mb-2">{booking.package_title}</h3>
                    <p className="text-gray-400 mb-3">{booking.venue_name}</p>

                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-pink-500" />
                        {new Date(booking.booking_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-pink-500" />
                        {booking.booking_time}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-pink-500" />
                        {booking.party_size} people
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-pink-500" />
                        {booking.total_price.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {booking.booking_status === 'confirmed' && (
                    <button
                      onClick={() => cancelBooking(booking.id)}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg transition"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Package Detail Modal */}
      {selectedPackage && !showBookingModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="relative">
              {selectedPackage.photos && selectedPackage.photos.length > 0 && (
                <img
                  src={selectedPackage.photos[0]}
                  alt={selectedPackage.title}
                  className="w-full h-64 object-cover"
                />
              )}
              <button
                onClick={() => setSelectedPackage(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-lg transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPackageColor(selectedPackage.package_type)}`}>
                    {selectedPackage.package_type}
                  </span>
                  <h2 className="text-2xl font-bold mt-3">{selectedPackage.title}</h2>
                  {selectedPackage.tagline && (
                    <p className="text-gray-400 mt-2">{selectedPackage.tagline}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-pink-500">
                    ${selectedPackage.base_price.toFixed(0)}
                    {selectedPackage.price_per_person && <span className="text-sm">/person</span>}
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <Star className="w-4 h-4 text-yellow-500" />
                    {selectedPackage.avg_review_rating.toFixed(1)}
                    <span className="text-gray-400 text-sm">({selectedPackage.review_count} reviews)</span>
                  </div>
                </div>
              </div>

              {/* Venue Info */}
              <div className="bg-white/5 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-pink-500" />
                  {selectedPackage.venue_name}
                </h3>
                <p className="text-gray-400">{selectedPackage.venue_address}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedPackage.ambiance?.slice(0, 3).map((a, i) => (
                    <span key={i} className="px-2 py-1 bg-white/10 rounded text-xs">
                      {a}
                    </span>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="mb-4">
                <h3 className="font-semibold mb-2">About This Experience</h3>
                <p className="text-gray-300">{selectedPackage.description}</p>
              </div>

              {/* What's Included */}
              {selectedPackage.inclusions && selectedPackage.inclusions.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">What's Included</h3>
                  <ul className="space-y-1">
                    {selectedPackage.inclusions.map((item, i) => (
                      <li key={i} className="text-gray-300 flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Details */}
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="bg-white/5 rounded-lg p-3">
                  <Clock className="w-5 h-5 text-pink-500 mb-1" />
                  <div className="text-sm text-gray-400">Duration</div>
                  <div className="font-semibold">{selectedPackage.duration_text || `${selectedPackage.duration_hours} hours`}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <Users className="w-5 h-5 text-pink-500 mb-1" />
                  <div className="text-sm text-gray-400">Party Size</div>
                  <div className="font-semibold">{selectedPackage.min_party_size}-{selectedPackage.max_party_size} people</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <TrendingUp className="w-5 h-5 text-pink-500 mb-1" />
                  <div className="text-sm text-gray-400">Popularity</div>
                  <div className="font-semibold">{selectedPackage.booking_count} bookings</div>
                </div>
              </div>

              {/* Tags */}
              {selectedPackage.tags && selectedPackage.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedPackage.tags.map((tag, i) => (
                    <span key={i} className="px-3 py-1 bg-white/10 rounded-full text-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBookingModal(true)}
                  className="flex-1 px-6 py-3 bg-pink-500 hover:bg-pink-600 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Calendar className="w-5 h-5" />
                  Book This Experience
                </button>
                <button
                  onClick={() => {
                    setShowReviewsModal(true);
                  }}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-lg transition flex items-center gap-2"
                >
                  <MessageSquare className="w-5 h-5" />
                  Reviews ({selectedPackage.review_count})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {showBookingModal && selectedPackage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Book Your Date</h2>
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Package Summary */}
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="font-semibold">{selectedPackage.title}</h3>
                <p className="text-gray-400 text-sm">{selectedPackage.venue_name}</p>
                <div className="text-xl font-bold text-pink-500 mt-2">
                  ${selectedPackage.base_price.toFixed(0)}
                  {selectedPackage.price_per_person && <span className="text-sm">/person</span>}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium mb-1">Date *</label>
                <input
                  type="date"
                  value={bookingData.date}
                  onChange={(e) => setBookingData({ ...bookingData, date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-sm font-medium mb-1">Time *</label>
                <select
                  value={bookingData.time}
                  onChange={(e) => setBookingData({ ...bookingData, time: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                >
                  <option value="">Select time</option>
                  <option value="17:00">5:00 PM</option>
                  <option value="18:00">6:00 PM</option>
                  <option value="19:00">7:00 PM</option>
                  <option value="20:00">8:00 PM</option>
                  <option value="21:00">9:00 PM</option>
                </select>
              </div>

              {/* Party Size */}
              <div>
                <label className="block text-sm font-medium mb-1">Party Size *</label>
                <input
                  type="number"
                  min={selectedPackage.min_party_size}
                  max={selectedPackage.max_party_size}
                  value={bookingData.partySize}
                  onChange={(e) => setBookingData({ ...bookingData, partySize: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {selectedPackage.min_party_size}-{selectedPackage.max_party_size} people
                </p>
              </div>

              {/* Occasion */}
              <div>
                <label className="block text-sm font-medium mb-1">Occasion (optional)</label>
                <select
                  value={bookingData.occasion}
                  onChange={(e) => setBookingData({ ...bookingData, occasion: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                >
                  <option value="">Select occasion</option>
                  <option value="first-date">First Date</option>
                  <option value="anniversary">Anniversary</option>
                  <option value="birthday">Birthday</option>
                  <option value="special-occasion">Special Occasion</option>
                  <option value="just-because">Just Because</option>
                </select>
              </div>

              {/* Special Requests */}
              <div>
                <label className="block text-sm font-medium mb-1">Special Requests (optional)</label>
                <textarea
                  value={bookingData.specialRequests}
                  onChange={(e) => setBookingData({ ...bookingData, specialRequests: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  rows={3}
                  placeholder="Any special requests or accommodations..."
                />
              </div>

              {/* Dietary Restrictions */}
              <div>
                <label className="block text-sm font-medium mb-1">Dietary Restrictions (optional)</label>
                <input
                  type="text"
                  value={bookingData.dietaryRestrictions}
                  onChange={(e) => setBookingData({ ...bookingData, dietaryRestrictions: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-pink-500 focus:outline-none"
                  placeholder="Vegetarian, vegan, allergies, etc."
                />
              </div>

              {/* Submit */}
              <button
                onClick={createBooking}
                disabled={!bookingData.date || !bookingData.time}
                className="w-full px-6 py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Confirm Booking
              </button>

              <p className="text-xs text-gray-400 text-center">
                By booking, you agree to our cancellation policy. Full refund for cancellations 24+ hours in advance.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

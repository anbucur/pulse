/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { pool } from '../config/index.js';

const router = express.Router();

// Middleware to verify authentication
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    req.user = { id: decoded.userId || decoded.sub };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Generate unique confirmation code
const generateConfirmationCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'PULSE-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// GET /api/marketplace/packages - Browse date packages with filters
router.get('/packages', async (req: any, res: any) => {
  try {
    const {
      search,
      venue_type,
      package_type,
      vibe,
      min_price,
      max_price,
      min_rating,
      dietary,
      good_for,
      sort_by = 'popularity',
      page = '1',
      limit = '20'
    } = req.query;

    const userId = req.headers['authorization'] ? (() => {
      try {
        const token = req.headers['authorization'].split(' ')[1];
        const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return decoded.userId || decoded.sub;
      } catch {
        return null;
      }
    })() : null;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    let query = `
      SELECT
        dp.*,
        v.name as venue_name,
        v.address as venue_address,
        v.city as venue_city,
        v.state as venue_state,
        v.latitude as venue_latitude,
        v.longitude as venue_longitude,
        v.photos as venue_photos,
        v.average_rating as venue_rating,
        v.ambiance,
        COALESCE(AVG(pr.overall_rating), 0) as avg_review_rating,
        COUNT(DISTINCT pr.id) as review_count
      FROM date_packages dp
      JOIN venues v ON dp.venue_id = v.id
      LEFT JOIN package_reviews pr ON dp.id = pr.package_id
      WHERE dp.is_active = true AND v.is_active = true
    `;
    const params: any[] = [];
    let paramCount = 1;

    // Add filters
    if (search) {
      query += ` AND (dp.title ILIKE $${paramCount} OR dp.description ILIKE $${paramCount} OR v.name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    if (venue_type) {
      query += ` AND v.venue_type @> $${paramCount}`;
      params.push([venue_type]);
      paramCount++;
    }

    if (package_type) {
      query += ` AND dp.package_type = $${paramCount}`;
      params.push(package_type);
      paramCount++;
    }

    if (vibe) {
      query += ` AND dp.vibe @> $${paramCount}`;
      params.push([vibe]);
      paramCount++;
    }

    if (min_price) {
      query += ` AND dp.base_price >= $${paramCount}`;
      params.push(parseFloat(min_price as string));
      paramCount++;
    }

    if (max_price) {
      query += ` AND dp.base_price <= $${paramCount}`;
      params.push(parseFloat(max_price as string));
      paramCount++;
    }

    if (min_rating) {
      query += ` AND v.average_rating >= $${paramCount}`;
      params.push(parseFloat(min_rating as string));
      paramCount++;
    }

    if (dietary) {
      query += ` AND dp.dietary_accommodations @> $${paramCount}`;
      params.push([dietary]);
      paramCount++;
    }

    if (good_for) {
      query += ` AND dp.good_for @> $${paramCount}`;
      params.push([good_for]);
      paramCount++;
    }

    query += ` GROUP BY dp.id, v.id`;

    // Sorting
    switch (sort_by) {
      case 'price_low':
        query += ` ORDER BY dp.base_price ASC`;
        break;
      case 'price_high':
        query += ` ORDER BY dp.base_price DESC`;
        break;
      case 'rating':
        query += ` ORDER BY v.average_rating DESC NULLS LAST`;
        break;
      case 'newest':
        query += ` ORDER BY dp.created_at DESC`;
        break;
      case 'popularity':
      default:
        query += ` ORDER BY dp.popularity_score DESC, dp.booking_count DESC`;
        break;
    }

    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit as string), offset);

    const result = await pool.query(query, params);

    // Get user profile for personalization if authenticated
    let userProfile = null;
    if (userId) {
      const profileResult = await pool.query(
        'SELECT diet, interests, location FROM profiles WHERE user_id = $1',
        [userId]
      );
      if (profileResult.rows.length > 0) {
        userProfile = profileResult.rows[0];
      }
    }

    // Auto-suggest based on user profile
    const packages = result.rows.map((pkg: any) => {
      const matchScore = userProfile ? {
        dietary: pkg.dietary_accommodations?.includes(userProfile.diet) || pkg.dietary_accommodations?.includes('any'),
        interests: pkg.tags?.some((tag: string) => userProfile.interests?.includes(tag)) || false,
        vibe: pkg.vibe?.some((v: string) => userProfile.interests?.includes(v)) || false
      } : null;

      return {
        ...pkg,
        match_score: matchScore ? Object.values(matchScore).filter(Boolean).length : 0,
        dietary_match: matchScore?.dietary || false,
        interests_match: matchScore?.interests || false
      };
    });

    // Sort by match score if user is authenticated
    if (userId) {
      packages.sort((a: any, b: any) => b.match_score - a.match_score);
    }

    res.json({
      packages,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// GET /api/marketplace/packages/:id - Get package details
router.get('/packages/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
        dp.*,
        v.name as venue_name,
        v.address as venue_address,
        v.city as venue_city,
        v.state as venue_state,
        v.postal_code as venue_postal_code,
        v.phone as venue_phone,
        v.email as venue_email,
        v.website as venue_website,
        v.latitude as venue_latitude,
        v.longitude as venue_longitude,
        v.photos as venue_photos,
        v.logo_url as venue_logo,
        v.cover_photo_url as venue_cover,
        v.average_rating as venue_rating,
        v.total_reviews as venue_total_reviews,
        v.ambiance,
        v.amenities,
        v.dress_code
      FROM date_packages dp
      JOIN venues v ON dp.venue_id = v.id
      WHERE dp.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Package not found' });
    }

    const pkg = result.rows[0];

    // Get available time slots (simplified - in production, check actual availability)
    const availableSlots = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      if (!pkg.available_days || pkg.available_days.length === 0 ||
          pkg.available_days.includes(date.toLocaleLowerCase('en-US', { weekday: 'long' }))) {
        availableSlots.push({
          date: date.toISOString().split('T')[0],
          times: ['17:00', '18:00', '19:00', '20:00', '21:00']
        });
      }
    }

    // Get reviews
    const reviewsResult = await pool.query(
      `SELECT
        pr.*,
        u.display_name as reviewer_name,
        p.photos as reviewer_photos
      FROM package_reviews pr
      JOIN users u ON pr.user_id = u.id
      LEFT JOIN profiles p ON pr.user_id = p.user_id
      WHERE pr.package_id = $1 AND pr.is_hidden = false
      ORDER BY pr.created_at DESC
      LIMIT 10`,
      [id]
    );

    res.json({
      ...pkg,
      available_slots: availableSlots,
      reviews: reviewsResult.rows
    });
  } catch (error) {
    console.error('Error fetching package:', error);
    res.status(500).json({ error: 'Failed to fetch package' });
  }
});

// POST /api/marketplace/packages/:id/book - Book a package
router.post('/packages/:id/book', authenticateToken, async (req: any, res: any) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const {
      booking_date,
      booking_time,
      party_size,
      special_requests,
      dietary_restrictions,
      occasion,
      celebration_details
    } = req.body;

    if (!booking_date || !booking_time || !party_size) {
      return res.status(400).json({ error: 'booking_date, booking_time, and party_size are required' });
    }

    await client.query('BEGIN');

    // Get package details
    const packageResult = await client.query(
      `SELECT dp.*, v.commission_rate, v.name as venue_name
      FROM date_packages dp
      JOIN venues v ON dp.venue_id = v.id
      WHERE dp.id = $1`,
      [id]
    );

    if (packageResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Package not found' });
    }

    const pkg = packageResult.rows[0];

    // Validate party size
    if (party_size < pkg.min_party_size || party_size > pkg.max_party_size) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Party size must be between ${pkg.min_party_size} and ${pkg.max_party_size}`
      });
    }

    // Calculate pricing
    const totalPrice = pkg.price_per_person
      ? pkg.base_price * party_size
      : pkg.base_price;
    const commissionAmount = totalPrice * (pkg.commission_rate / 100);
    const venuePayout = totalPrice - commissionAmount;

    // Generate unique confirmation code
    let confirmationCode;
    let codeExists = true;
    while (codeExists) {
      confirmationCode = generateConfirmationCode();
      const existingCode = await client.query(
        'SELECT id FROM package_bookings WHERE confirmation_code = $1',
        [confirmationCode]
      );
      codeExists = existingCode.rows.length > 0;
    }

    // Create booking
    const bookingResult = await client.query(
      `INSERT INTO package_bookings (
        package_id, user_id, venue_id, booking_date, booking_time, party_size,
        special_requests, dietary_restrictions, occasion, celebration_details,
        total_price, commission_amount, venue_payout, confirmation_code
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        id, userId, pkg.venue_id, booking_date, booking_time, party_size,
        special_requests || null, dietary_restrictions || null, occasion || null, celebration_details || null,
        totalPrice, commissionAmount, venuePayout, confirmationCode
      ]
    );

    const booking = bookingResult.rows[0];

    // Update package booking count and popularity
    await client.query(
      `UPDATE date_packages
      SET booking_count = booking_count + 1,
          popularity_score = popularity_score + 10,
          view_count = view_count + 1
      WHERE id = $1`,
      [id]
    );

    // Update venue booking count
    await client.query(
      `UPDATE venues
      SET total_bookings = total_bookings + 1
      WHERE id = $1`,
      [pkg.venue_id]
    );

    // Create revenue tracking record
    await client.query(
      `INSERT INTO revenue_tracking (
        venue_id, booking_id, transaction_type, transaction_date,
        gross_amount, commission_amount, net_payout, commission_rate
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        pkg.venue_id,
        booking.id,
        'booking',
        booking_date,
        totalPrice,
        commissionAmount,
        venuePayout,
        pkg.commission_rate
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      booking: {
        id: booking.id,
        confirmationCode: booking.confirmation_code,
        bookingDate: booking.booking_date,
        bookingTime: booking.booking_time,
        totalPrice: booking.total_price,
        status: booking.booking_status
      },
      venue: {
        name: pkg.venue_name
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  } finally {
    client.release();
  }
});

// GET /api/marketplace/bookings - Get user's bookings
router.get('/bookings', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { status, upcoming = 'true' } = req.query;

    let query = `
      SELECT
        pb.*,
        dp.title as package_title,
        dp.photos as package_photos,
        v.name as venue_name,
        v.address as venue_address,
        v.city as venue_city,
        v.state as venue_state,
        v.phone as venue_phone,
        v.latitude as venue_latitude,
        v.longitude as venue_longitude
      FROM package_bookings pb
      JOIN date_packages dp ON pb.package_id = dp.id
      JOIN venues v ON pb.venue_id = v.id
      WHERE pb.user_id = $1
    `;
    const params: any[] = [userId];

    if (status) {
      query += ` AND pb.booking_status = $2`;
      params.push(status);
    }

    if (upcoming === 'true') {
      query += ` AND pb.booking_date >= CURRENT_DATE AND pb.is_cancelled = false`;
    }

    query += ` ORDER BY pb.booking_date ASC, pb.booking_time ASC`;

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET /api/marketplace/bookings/:id - Get booking details
router.get('/bookings/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
        pb.*,
        dp.title as package_title,
        dp.description as package_description,
        dp.inclusions,
        v.name as venue_name,
        v.address as venue_address,
        v.city as venue_city,
        v.state as venue_state,
        v.phone as venue_phone,
        v.email as venue_email,
        v.website as venue_website,
        v.latitude as venue_latitude,
        v.longitude as venue_longitude,
        v.photos as venue_photos
      FROM package_bookings pb
      JOIN date_packages dp ON pb.package_id = dp.id
      JOIN venues v ON pb.venue_id = v.id
      WHERE pb.id = $1 AND pb.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// PATCH /api/marketplace/bookings/:id/cancel - Cancel a booking
router.patch('/bookings/:id/cancel', authenticateToken, async (req: any, res: any) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { reason } = req.body;

    await client.query('BEGIN');

    const bookingResult = await client.query(
      `SELECT * FROM package_bookings
      WHERE id = $1 AND user_id = $2 AND is_cancelled = false`,
      [id, userId]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found or already cancelled' });
    }

    const booking = bookingResult.rows[0];

    // Check if booking is in the past
    const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
    if (bookingDateTime < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot cancel past bookings' });
    }

    // Calculate refund (simple logic - full refund if 24+ hours notice)
    const hoursUntilBooking = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    let refundAmount = 0;
    let refundStatus = 'none';

    if (hoursUntilBooking >= 24) {
      refundAmount = booking.total_price;
      refundStatus = 'full';
    } else if (hoursUntilBooking >= 12) {
      refundAmount = booking.total_price * 0.5;
      refundStatus = 'partial';
    }

    await client.query(
      `UPDATE package_bookings
      SET is_cancelled = true,
          cancelled_at = CURRENT_TIMESTAMP,
          cancellation_reason = $1,
          refund_amount = $2,
          refund_status = $3,
          booking_status = 'cancelled'
      WHERE id = $4`,
      [reason || null, refundAmount, refundStatus, id]
    );

    // Update revenue tracking
    if (refundAmount > 0) {
      await client.query(
        `UPDATE revenue_tracking
        SET refund_amount = $1,
            refund_reason = $2,
            refund_processed_at = CURRENT_TIMESTAMP
        WHERE booking_id = $3`,
        [refundAmount, reason || 'User cancellation', id]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      refundAmount,
      refundStatus
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cancelling booking:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  } finally {
    client.release();
  }
});

// POST /api/marketplace/bookings/:id/review - Add review
router.post('/bookings/:id/review', authenticateToken, async (req: any, res: any) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const {
      overall_rating,
      atmosphere_rating,
      service_rating,
      value_rating,
      food_quality_rating,
      title,
      review,
      photos,
      review_tags,
      would_recommend,
      good_for
    } = req.body;

    if (!overall_rating || overall_rating < 1 || overall_rating > 5) {
      return res.status(400).json({ error: 'overall_rating (1-5) is required' });
    }

    await client.query('BEGIN');

    // Verify booking exists and belongs to user
    const bookingResult = await client.query(
      `SELECT * FROM package_bookings
      WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    // Check if review already exists
    const existingReview = await client.query(
      'SELECT id FROM package_reviews WHERE booking_id = $1',
      [id]
    );

    if (existingReview.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Review already exists for this booking' });
    }

    // Create review
    const reviewResult = await client.query(
      `INSERT INTO package_reviews (
        booking_id, package_id, venue_id, user_id,
        overall_rating, atmosphere_rating, service_rating, value_rating, food_quality_rating,
        title, review, photos, review_tags, would_recommend, good_for
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        id, booking.package_id, booking.venue_id, userId,
        overall_rating, atmosphere_rating || null, service_rating || null,
        value_rating || null, food_quality_rating || null,
        title || null, review || null, photos || null, review_tags || null,
        would_recommend !== undefined ? would_recommend : true, good_for || null
      ]
    );

    // Update venue ratings
    await client.query(
      `UPDATE venues v
      SET average_rating = (
        SELECT COALESCE(AVG(pr.overall_rating), 0)
        FROM package_reviews pr
        WHERE pr.venue_id = v.id
      ),
      total_reviews = total_reviews + 1
      WHERE v.id = $1`,
      [booking.venue_id]
    );

    await client.query('COMMIT');

    res.status(201).json(reviewResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  } finally {
    client.release();
  }
});

// GET /api/marketplace/venues - Venue dashboard (venue owners only)
router.get('/venues/dashboard', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
        v.*,
        COUNT(DISTINCT dp.id) as package_count,
        COUNT(DISTINCT pb.id) as total_bookings,
        COALESCE(SUM(pb.total_price), 0) as gross_revenue,
        COALESCE(SUM(pb.commission_amount), 0) as total_commissions,
        COALESCE(SUM(pb.venue_payout), 0) as net_payout,
        COALESCE(AVG(pr.overall_rating), 0) as average_rating
      FROM venues v
      LEFT JOIN date_packages dp ON v.id = dp.venue_id
      LEFT JOIN package_bookings pb ON dp.id = pb.package_id AND pb.is_cancelled = false
      LEFT JOIN package_reviews pr ON v.id = pr.venue_id
      WHERE v.owner_user_id = $1
      GROUP BY v.id`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ message: 'No venue found. Create one to get started.' });
    }

    // Get recent bookings
    const recentBookings = await pool.query(
      `SELECT
        pb.*,
        dp.title as package_title,
        u.display_name as customer_name,
        u.email as customer_email
      FROM package_bookings pb
      JOIN date_packages dp ON pb.package_id = dp.id
      JOIN venues v ON dp.venue_id = v.id
      LEFT JOIN users u ON pb.user_id = u.id
      WHERE v.owner_user_id = $1
      ORDER BY pb.created_at DESC
      LIMIT 10`,
      [userId]
    );

    // Get revenue analytics
    const revenueAnalytics = await pool.query(
      `SELECT
        DATE_TRUNC('month', transaction_date) as month,
        COUNT(*) as total_bookings,
        SUM(gross_amount) as gross_revenue,
        SUM(commission_amount) as total_commission,
        SUM(net_payout) as net_payout
      FROM revenue_tracking
      WHERE venue_id IN (SELECT id FROM venues WHERE owner_user_id = $1)
      GROUP BY DATE_TRUNC('month', transaction_date)
      ORDER BY month DESC
      LIMIT 12`,
      [userId]
    );

    res.json({
      venue: result.rows[0],
      recent_bookings: recentBookings.rows,
      revenue_analytics: revenueAnalytics.rows
    });
  } catch (error) {
    console.error('Error fetching venue dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// POST /api/marketplace/venues - Create venue
router.post('/venues', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const {
      name,
      description,
      tagline,
      address,
      city,
      state,
      postal_code,
      latitude,
      longitude,
      phone,
      email,
      website,
      venue_type,
      ambiance,
      price_range,
      dress_code,
      amenities,
      dietary_options,
      photos
    } = req.body;

    if (!name || !address) {
      return res.status(400).json({ error: 'name and address are required' });
    }

    const result = await pool.query(
      `INSERT INTO venues (
        owner_user_id, name, description, tagline, address, city, state, postal_code,
        latitude, longitude, phone, email, website, venue_type, ambiance,
        price_range, dress_code, amenities, dietary_options, photos
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`,
      [
        userId, name, description || null, tagline || null, address, city || null,
        state || null, postal_code || null, latitude || null, longitude || null,
        phone || null, email || null, website || null, venue_type || null,
        ambiance || null, price_range || null, dress_code || null,
        amenities || null, dietary_options || null, photos || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating venue:', error);
    res.status(500).json({ error: 'Failed to create venue' });
  }
});

// POST /api/marketplace/packages - Create date package (venue owners)
router.post('/packages', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const {
      venue_id,
      title,
      description,
      tagline,
      package_type,
      vibe,
      date_intensity,
      base_price,
      price_per_person,
      min_party_size,
      max_party_size,
      duration_hours,
      duration_text,
      inclusions,
      exclusions,
      dietary_accommodations,
      restrictions,
      available_days,
      advance_booking_hours,
      photos,
      tags,
      good_for
    } = req.body;

    if (!venue_id || !title || !description || !package_type || !base_price) {
      return res.status(400).json({
        error: 'venue_id, title, description, package_type, and base_price are required'
      });
    }

    // Verify user owns the venue
    const venueResult = await pool.query(
      'SELECT id FROM venues WHERE id = $1 AND owner_user_id = $2',
      [venue_id, userId]
    );

    if (venueResult.rows.length === 0) {
      return res.status(403).json({ error: 'You do not own this venue' });
    }

    const result = await pool.query(
      `INSERT INTO date_packages (
        venue_id, title, description, tagline, package_type, vibe, date_intensity,
        base_price, price_per_person, min_party_size, max_party_size,
        duration_hours, duration_text, inclusions, exclusions,
        dietary_accommodations, restrictions, available_days, advance_booking_hours,
        photos, tags, good_for
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *`,
      [
        venue_id, title, description, tagline || null, package_type, vibe || null,
        date_intensity || null, base_price, price_per_person || false,
        min_party_size || 2, max_party_size || 10, duration_hours || null,
        duration_text || null, inclusions || null, exclusions || null,
        dietary_accommodations || null, restrictions || null,
        available_days || null, advance_booking_hours || 24,
        photos || null, tags || null, good_for || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating package:', error);
    res.status(500).json({ error: 'Failed to create package' });
  }
});

export default router;

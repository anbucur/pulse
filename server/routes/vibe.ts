import { Router } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { pool } from '../config/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/', asyncHandler(async (req: AuthRequest, res) => {
  const { date, mood, energy, social_appetite, note } = req.body;

  if (!date || !mood) {
    throw new AppError('Date and mood are required', 400);
  }

  const validMoods = ['high-energy', 'hermit', 'social', 'creative', 'intimate'];
  if (!validMoods.includes(mood)) {
    throw new AppError('Invalid mood value', 400);
  }

  if (energy < 0 || energy > 100 || social_appetite < 0 || social_appetite > 100) {
    throw new AppError('Energy and social_appetite must be between 0 and 100', 400);
  }

  const result = await pool.query(
    `INSERT INTO vibe_entries (user_id, date, mood, energy, social_appetite, note)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, date)
     DO UPDATE SET
       mood = EXCLUDED.mood,
       energy = EXCLUDED.energy,
       social_appetite = EXCLUDED.social_appetite,
       note = EXCLUDED.note,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [req.userId, date, mood, energy || 50, social_appetite || 50, note || null]
  );

  res.json(result.rows[0]);
}));

router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const { start, end } = req.query;

  let query = `
    SELECT * FROM vibe_entries
    WHERE user_id = $1
  `;
  const params: any[] = [req.userId];

  if (start && end) {
    query += ` AND date >= $2 AND date <= $3`;
    params.push(start as string, end as string);
  }

  query += ` ORDER BY date DESC`;

  const entriesResult = await pool.query(query, params);

  const entries = entriesResult.rows;

  let stats = null;
  if (entries.length > 0) {
    const totalEnergy = entries.reduce((sum, e) => sum + e.energy, 0);
    const totalSocial = entries.reduce((sum, e) => sum + e.social_appetite, 0);

    const moodCounts: Record<string, number> = {};
    entries.forEach(e => {
      moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
    });
    const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0][0];

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (entries.length >= 2) {
      const recentAvg = (entries[0].energy + entries[0].social_appetite) / 2;
      const olderAvg = (entries[entries.length - 1].energy + entries[entries.length - 1].social_appetite) / 2;
      if (recentAvg - olderAvg > 10) trend = 'up';
      else if (olderAvg - recentAvg > 10) trend = 'down';
    }

    stats = {
      avgEnergy: Math.round(totalEnergy / entries.length),
      avgSocial: Math.round(totalSocial / entries.length),
      dominantMood,
      trend,
    };
  }

  res.json({ entries, stats });
}));

router.get('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const result = await pool.query(
    'SELECT * FROM vibe_entries WHERE id = $1 AND user_id = $2',
    [id, req.userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Entry not found', 404);
  }

  res.json(result.rows[0]);
}));

router.put('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { date, mood, energy, social_appetite, note } = req.body;

  const validMoods = ['high-energy', 'hermit', 'social', 'creative', 'intimate'];
  if (mood && !validMoods.includes(mood)) {
    throw new AppError('Invalid mood value', 400);
  }

  const result = await pool.query(
    `UPDATE vibe_entries
     SET date = COALESCE($1, date),
         mood = COALESCE($2, mood),
         energy = COALESCE($3, energy),
         social_appetite = COALESCE($4, social_appetite),
         note = COALESCE($5, note),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $6 AND user_id = $7
     RETURNING *`,
    [date, mood, energy, social_appetite, note, id, req.userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Entry not found', 404);
  }

  res.json(result.rows[0]);
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const result = await pool.query(
    'DELETE FROM vibe_entries WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, req.userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Entry not found', 404);
  }

  res.json({ message: 'Entry deleted' });
}));

router.get('/patterns/summary', asyncHandler(async (req: AuthRequest, res) => {
  const { days = 30 } = req.query;

  const result = await pool.query(
    `SELECT * FROM vibe_entries
     WHERE user_id = $1
       AND date >= CURRENT_DATE - INTERVAL '${parseInt(days as string)} days'
     ORDER BY date DESC`,
    [req.userId]
  );

  const entries = result.rows;

  if (entries.length === 0) {
    return res.json({
      totalEntries: 0,
      avgEnergy: 0,
      avgSocial: 0,
      moodDistribution: {},
      dailyPattern: [],
    });
  }

  const moodDistribution: Record<string, number> = {};
  entries.forEach(e => {
    moodDistribution[e.mood] = (moodDistribution[e.mood] || 0) + 1;
  });

  const dayOfWeekMap: Record<string, { energy: number; social: number; count: number }> = {};
  entries.forEach(e => {
    const dayOfWeek = new Date(e.date).toLocaleDateString('en-US', { weekday: 'short' });
    if (!dayOfWeekMap[dayOfWeek]) {
      dayOfWeekMap[dayOfWeek] = { energy: 0, social: 0, count: 0 };
    }
    dayOfWeekMap[dayOfWeek].energy += e.energy;
    dayOfWeekMap[dayOfWeek].social += e.social_appetite;
    dayOfWeekMap[dayOfWeek].count += 1;
  });

  const dailyPattern = Object.entries(dayOfWeekMap).map(([day, data]) => ({
    day,
    avgEnergy: Math.round(data.energy / data.count),
    avgSocial: Math.round(data.social / data.count),
    count: data.count,
  }));

  res.json({
    totalEntries: entries.length,
    avgEnergy: Math.round(entries.reduce((sum, e) => sum + e.energy, 0) / entries.length),
    avgSocial: Math.round(entries.reduce((sum, e) => sum + e.social_appetite, 0) / entries.length),
    moodDistribution,
    dailyPattern,
  });
}));

export default router;
import { Router } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { meilisearch } from '../config/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// All search routes require authentication
router.use(authenticate);

// Index documents
router.post('/index/:indexName', asyncHandler(async (req: AuthRequest, res) => {
  const { indexName } = req.params;
  const { documents } = req.body;

  const index = meilisearch.index(indexName);
  await index.addDocuments(documents);

  res.json({ message: 'Documents indexed', count: documents.length });
}));

// Update documents
router.put('/update/:indexName', asyncHandler(async (req: AuthRequest, res) => {
  const { indexName } = req.params;
  const { documents } = req.body;

  const index = meilisearch.index(indexName);
  await index.updateDocuments(documents);

  res.json({ message: 'Documents updated', count: documents.length });
}));

// Delete documents
router.delete('/delete/:indexName', asyncHandler(async (req: AuthRequest, res) => {
  const { indexName } = req.params;
  const { ids } = req.body;

  const index = meilisearch.index(indexName);
  await index.deleteDocuments(ids);

  res.json({ message: 'Documents deleted', count: ids.length });
}));

// Search
router.get('/:indexName', asyncHandler(async (req: AuthRequest, res) => {
  const { indexName } = req.params;
  const { q, limit = 20, ageRange, distance, gender, orientation, relationshipStyle, interests, hasPhoto, isVerified, isOnline } = req.query;

  const index = meilisearch.index(indexName);

  const searchParams: any = {
    limit: parseInt(limit as string),
    q: q as string || '',
  };

  // Build filter
  const filters: string[] = [];

  if (ageRange) {
    const [min, max] = (ageRange as string).split('-');
    filters.push(`age >= ${min} AND age <= ${max}`);
  }

  if (gender) {
    const genders = (gender as string).split(',');
    filters.push(`gender IN [${genders.map((g: string) => `"${g}"`).join(',')}]`);
  }

  if (orientation) {
    const orientations = (orientation as string).split(',');
    filters.push(`sexualOrientation IN [${orientations.map((o: string) => `"${o}"`).join(',')}]`);
  }

  if (hasPhoto === 'true') {
    filters.push('hasPhoto = true');
  }

  if (isVerified === 'true') {
    filters.push('isVerified = true');
  }

  if (filters.length > 0) {
    searchParams.filter = filters.join(' AND ');
  }

  const results = await index.search(searchParams.q, searchParams);

  res.json({
    hits: results.hits,
    totalHits: results.totalHits,
    query: results.query,
  });
}));

// Suggestions
router.get('/suggest/:indexName', asyncHandler(async (req: AuthRequest, res) => {
  const { indexName } = req.params;
  const { q, limit = 5 } = req.query;

  const index = meilisearch.index(indexName);
  const results = await index.search(q as string, {
    limit: parseInt(limit as string),
    attributesToRetrieve: ['displayName', 'bio'],
  });

  const suggestions = results.hits.map((hit: any) => hit.displayName || hit.bio);

  res.json(suggestions.slice(0, parseInt(limit as string)));
}));

export default router;

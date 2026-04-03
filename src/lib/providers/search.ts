// Search Provider Interface
export interface SearchResult {
  id: string;
  score: number;
  highlights?: Record<string, string[]>;
}

export interface SearchFilters {
  ageRange?: [number, number];
  distance?: number;
  gender?: string[];
  orientation?: string[];
  relationshipStyle?: string[];
  interests?: string[];
  hasPhoto?: boolean;
  isVerified?: boolean;
  isOnline?: boolean;
}

export interface SearchIndexDocument {
  id: string;
  [key: string]: any;
}

export interface ISearchProvider {
  index(indexName: string, documents: SearchIndexDocument[]): Promise<void>;
  update(indexName: string, documents: SearchIndexDocument[]): Promise<void>;
  delete(indexName: string, ids: string[]): Promise<void>;
  search(indexName: string, query: string, filters?: SearchFilters, limit?: number): Promise<SearchResult[]>;
  suggest(indexName: string, query: string, limit?: number): Promise<string[]>;
}

// Meilisearch Implementation
export class SearchProvider implements ISearchProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.MEILISEARCH_ENDPOINT || 'http://localhost:7700';
    this.apiKey = process.env.MEILISEARCH_API_KEY || '';
  }

  async index(indexName: string, documents: SearchIndexDocument[]): Promise<void> {
    await fetch(`/api/search/index/${indexName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ documents })
    });
  }

  async update(indexName: string, documents: SearchIndexDocument[]): Promise<void> {
    await fetch(`/api/search/update/${indexName}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ documents })
    });
  }

  async delete(indexName: string, ids: string[]): Promise<void> {
    await fetch(`/api/search/delete/${indexName}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ ids })
    });
  }

  async search(indexName: string, query: string, filters?: SearchFilters, limit: number = 20): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString()
    });

    if (filters) {
      if (filters.ageRange) params.append('ageRange', `${filters.ageRange[0]}-${filters.ageRange[1]}`);
      if (filters.distance) params.append('distance', filters.distance.toString());
      if (filters.gender) params.append('gender', filters.gender.join(','));
      if (filters.orientation) params.append('orientation', filters.orientation.join(','));
      if (filters.relationshipStyle) params.append('relationshipStyle', filters.relationshipStyle.join(','));
      if (filters.interests) params.append('interests', filters.interests.join(','));
      if (filters.hasPhoto !== undefined) params.append('hasPhoto', String(filters.hasPhoto));
      if (filters.isVerified !== undefined) params.append('isVerified', String(filters.isVerified));
      if (filters.isOnline !== undefined) params.append('isOnline', String(filters.isOnline));
    }

    const response = await fetch(`/api/search/${indexName}?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error('Search failed');
    }

    return response.json();
  }

  async suggest(indexName: string, query: string, limit: number = 5): Promise<string[]> {
    const response = await fetch(`/api/search/suggest/${indexName}?q=${query}&limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error('Suggestion failed');
    }

    return response.json();
  }
}

export const searchProvider = new SearchProvider();

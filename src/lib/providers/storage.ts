// Storage Provider Interface
export interface UploadResult {
  url: string;
  key: string;
  size: number;
  contentType: string;
}

export interface FileUploadOptions {
  folder?: string;
  isPublic?: boolean;
  metadata?: Record<string, string>;
}

export interface IStorageProvider {
  upload(file: File, options?: FileUploadOptions): Promise<UploadResult>;
  uploadMultiple(files: File[], options?: FileUploadOptions): Promise<UploadResult[]>;
  delete(key: string): Promise<void>;
  deleteMultiple(keys: string[]): Promise<void>;
  getPresignedUrl(key: string, expiresIn?: number): Promise<string>;
  getUrl(key: string): string;
}

// MinIO Implementation
export class StorageProvider implements IStorageProvider {
  private baseUrl: string;
  private bucket: string;

  constructor() {
    this.baseUrl = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
    this.bucket = process.env.MINIO_BUCKET || 'pulse';
  }

  async upload(file: File, options: FileUploadOptions = {}): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', options.folder || 'uploads');
    formData.append('isPublic', String(options.isPublic !== false));
    if (options.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    const response = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return response.json();
  }

  async uploadMultiple(files: File[], options?: FileUploadOptions): Promise<UploadResult[]> {
    const results = await Promise.all(
      files.map(file => this.upload(file, options))
    );
    return results;
  }

  async delete(key: string): Promise<void> {
    await fetch(`/api/storage/delete/${key}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
  }

  async deleteMultiple(keys: string[]): Promise<void> {
    await Promise.all(keys.map(key => this.delete(key)));
  }

  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const response = await fetch(`/api/storage/presigned/${key}?expiresIn=${expiresIn}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get presigned URL');
    }

    const data = await response.json();
    return data.url;
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/${this.bucket}/${key}`;
  }
}

export const storageProvider = new StorageProvider();

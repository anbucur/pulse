// Provider interfaces and implementations
export { AuthProvider } from './auth.js';
export { StorageProvider } from './storage.js';
export { SearchProvider } from './search.js';
export { AIProvider } from './ai.js';
export { PushProvider } from './push.js';
export { ChatProvider } from './chat.js';

// Singleton instances
export { authProvider } from './auth.js';
export { storageProvider } from './storage.js';
export { searchProvider } from './search.js';
export { aiProvider } from './ai.js';
export { pushProvider } from './push.js';
export { chatProvider } from './chat.js';

export type {
  IAuthProvider,
  AuthUser,
  AuthCredentials,
  RegisterData,
  AuthResult
} from './auth.js';

export type {
  IStorageProvider,
  UploadResult,
  FileUploadOptions
} from './storage.js';

export type {
  ISearchProvider,
  SearchResult,
  SearchFilters,
  SearchIndexDocument
} from './search.js';

export type {
  IAIProvider,
  AICompletionOptions,
  AICompletionResult,
  AIEmbeddingResult
} from './ai.js';

export type {
  IPushProvider,
  PushNotification,
  PushSubscription
} from './push.js';

export type {
  IChatProvider,
  ChatMessage,
  ChatRoom,
  TypingIndicator
} from './chat.js';

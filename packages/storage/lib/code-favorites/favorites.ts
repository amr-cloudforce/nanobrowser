import { StorageEnum } from '../base/enums';
import { createStorage } from '../base/base';
import type { BaseStorage } from '../base/types';

// Define the code favorite type
export interface CodeFavorite {
  id: number;
  name: string;
  code: string;
  urlPattern: string;
  useCount: number;
  createdAt: number;
}

// Define the code favorites storage type
export interface CodeFavoritesStorage {
  nextId: number;
  favorites: CodeFavorite[];
}

// Define the interface for code favorites storage operations
export interface CodeFavoritesStorageInterface {
  addFavorite: (name: string, code: string, urlPattern: string) => Promise<CodeFavorite>;
  updateFavorite: (id: number, name: string, code: string, urlPattern: string) => Promise<CodeFavorite | undefined>;
  removeFavorite: (id: number) => Promise<void>;
  getAllFavorites: () => Promise<CodeFavorite[]>;
  getFavoritesByUrl: (url: string) => Promise<CodeFavorite[]>;
  getFavoriteById: (id: number) => Promise<CodeFavorite | undefined>;
  incrementUseCount: (id: number) => Promise<void>;
}

// Initial state
const initialState: CodeFavoritesStorage = {
  nextId: 1,
  favorites: [],
};

// Create the code favorites storage
const codeFavoritesStorage: BaseStorage<CodeFavoritesStorage> = createStorage('codeFavorites', initialState, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

/**
 * Checks if a URL matches a URL pattern
 * Supports exact match, domain match, and wildcard patterns
 */
function urlMatchesPattern(url: string, pattern: string): boolean {
  try {
    const urlObj = new URL(url);
    const patternObj = new URL(pattern);

    // Exact match
    if (url === pattern) {
      return true;
    }

    // Domain match (same origin)
    if (urlObj.origin === patternObj.origin) {
      return true;
    }

    // Wildcard pattern support (e.g., "https://*.example.com/*")
    const patternRegex = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*'); // Replace * with .*
    const regex = new RegExp(`^${patternRegex}$`);
    return regex.test(url);
  } catch {
    // If URL parsing fails, do simple string comparison
    return url === pattern || url.includes(pattern) || pattern.includes(url);
  }
}

/**
 * Creates a storage interface for managing code favorites
 */
export function createCodeFavoritesStorage(): CodeFavoritesStorageInterface {
  return {
    addFavorite: async (name: string, code: string, urlPattern: string): Promise<CodeFavorite> => {
      await codeFavoritesStorage.set(prev => {
        const id = prev.nextId;
        const newFavorite: CodeFavorite = {
          id,
          name,
          code,
          urlPattern,
          useCount: 0,
          createdAt: Date.now(),
        };

        return {
          nextId: id + 1,
          favorites: [newFavorite, ...prev.favorites],
        };
      });

      return (await codeFavoritesStorage.get()).favorites[0];
    },

    updateFavorite: async (id: number, name: string, code: string, urlPattern: string): Promise<CodeFavorite | undefined> => {
      let updatedFavorite: CodeFavorite | undefined;

      await codeFavoritesStorage.set(prev => {
        const updatedFavorites = prev.favorites.map(favorite => {
          if (favorite.id === id) {
            updatedFavorite = { ...favorite, name, code, urlPattern };
            return updatedFavorite;
          }
          return favorite;
        });

        if (!updatedFavorite) {
          return prev;
        }

        return {
          ...prev,
          favorites: updatedFavorites,
        };
      });

      return updatedFavorite;
    },

    removeFavorite: async (id: number): Promise<void> => {
      await codeFavoritesStorage.set(prev => ({
        ...prev,
        favorites: prev.favorites.filter(favorite => favorite.id !== id),
      }));
    },

    getAllFavorites: async (): Promise<CodeFavorite[]> => {
      const { favorites } = await codeFavoritesStorage.get();
      return [...favorites].sort((a, b) => b.createdAt - a.createdAt);
    },

    getFavoritesByUrl: async (url: string): Promise<CodeFavorite[]> => {
      const { favorites } = await codeFavoritesStorage.get();
      return favorites.filter(favorite => urlMatchesPattern(url, favorite.urlPattern));
    },

    getFavoriteById: async (id: number): Promise<CodeFavorite | undefined> => {
      const { favorites } = await codeFavoritesStorage.get();
      return favorites.find(favorite => favorite.id === id);
    },

    incrementUseCount: async (id: number): Promise<void> => {
      await codeFavoritesStorage.set(prev => ({
        ...prev,
        favorites: prev.favorites.map(favorite =>
          favorite.id === id ? { ...favorite, useCount: favorite.useCount + 1 } : favorite,
        ),
      }));
    },
  };
}

// Export an instance of the storage by default
export default createCodeFavoritesStorage();


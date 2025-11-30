import { useState, useEffect } from 'react';
import { codeFavoritesStorage, type CodeFavorite } from '@extension/storage';

interface CodeFavoritesPanelProps {
  currentUrl: string | null;
  isDarkMode?: boolean;
  onExecuteFavorite: (code: string) => void;
}

export default function CodeFavoritesPanel({ currentUrl, isDarkMode = false, onExecuteFavorite }: CodeFavoritesPanelProps) {
  const [favorites, setFavorites] = useState<CodeFavorite[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        setIsLoading(true);
        if (currentUrl) {
          const urlFavorites = await codeFavoritesStorage.getFavoritesByUrl(currentUrl);
          setFavorites(urlFavorites);
        } else {
          // If no URL, show all favorites
          const allFavorites = await codeFavoritesStorage.getAllFavorites();
          setFavorites(allFavorites);
        }
      } catch (error) {
        console.error('Failed to load code favorites:', error);
        setFavorites([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadFavorites();

    // Listen for storage changes (liveUpdate is enabled)
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.codeFavorites) {
        loadFavorites();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [currentUrl]);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExecute = async (favorite: CodeFavorite) => {
    await codeFavoritesStorage.incrementUseCount(favorite.id);
    onExecuteFavorite(favorite.code);
    // Reload to update use count
    if (currentUrl) {
      const urlFavorites = await codeFavoritesStorage.getFavoritesByUrl(currentUrl);
      setFavorites(urlFavorites);
    } else {
      const allFavorites = await codeFavoritesStorage.getAllFavorites();
      setFavorites(allFavorites);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this favorite?')) {
      await codeFavoritesStorage.removeFavorite(id);
      if (currentUrl) {
        const urlFavorites = await codeFavoritesStorage.getFavoritesByUrl(currentUrl);
        setFavorites(urlFavorites);
      } else {
        const allFavorites = await codeFavoritesStorage.getAllFavorites();
        setFavorites(allFavorites);
      }
    }
  };

  return (
    <div className={`mb-4 space-y-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
      <div className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        💾 Code Favorites
      </div>
      {isLoading ? (
        <div className={`rounded-lg border p-3 ${isDarkMode ? 'border-sky-800/50 bg-slate-800/50' : 'border-sky-200 bg-sky-50'}`}>
          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Loading...
          </div>
        </div>
      ) : favorites.length === 0 ? (
        <div className={`rounded-lg border p-3 ${isDarkMode ? 'border-sky-800/50 bg-slate-800/50' : 'border-sky-200 bg-sky-50'}`}>
          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            No code favorites yet. Save executed code from Navigator messages to see them here.
          </div>
        </div>
      ) : (
        favorites.map(favorite => {
        const isExpanded = expandedIds.has(favorite.id);
        return (
          <div
            key={favorite.id}
            className={`rounded-lg border p-3 ${isDarkMode ? 'border-sky-800/50 bg-slate-800/50' : 'border-sky-200 bg-sky-50'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleExpand(favorite.id)}
                    className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'} hover:underline`}>
                    {isExpanded ? '▼' : '▶'} {favorite.name}
                  </button>
                </div>
                <div className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {favorite.urlPattern} • Used {favorite.useCount} time{favorite.useCount !== 1 ? 's' : ''}
                </div>
                {isExpanded && (
                  <div className={`mt-2 rounded bg-gray-900 p-2 font-mono text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <pre className="whitespace-pre-wrap break-words">{favorite.code}</pre>
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => handleExecute(favorite)}
                  className={`rounded px-2 py-1 text-xs transition-colors ${isDarkMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                  title="Execute code">
                  ▶️
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(favorite.id)}
                  className={`rounded px-2 py-1 text-xs transition-colors ${isDarkMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                  title="Delete favorite">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        );
      })
      )}
    </div>
  );
}

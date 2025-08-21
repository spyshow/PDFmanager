import { useState, useEffect } from "react";
import axios from "axios";

interface TagFilterProps {
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
}

export default function TagFilter({
  selectedTags,
  setSelectedTags,
}: TagFilterProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = async () => {
    try {
      const response = await axios.get("/files/tags/all");
      setTags(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching tags:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();

    // Listen for tag refresh events
    const handleTagRefresh = () => fetchTags();
    window.addEventListener("tags-updated", handleTagRefresh);

    return () => {
      window.removeEventListener("tags-updated", handleTagRefresh);
    };
  }, []);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const clearFilters = () => {
    setSelectedTags([]);
  };

  if (loading) {
    return (
      <div className="mb-4">
        <h3 className="font-semibold text-gray-600 mb-2">Filter by Tags:</h3>
        <div className="text-sm text-gray-500">Loading tags...</div>
      </div>
    );
  }

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-600">Filter by Tags:</h3>
        {selectedTags.length > 0 && (
          <button
            onClick={clearFilters}
            className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-md hover:bg-gray-300 transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              selectedTags.includes(tag)
                ? "bg-primary text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}

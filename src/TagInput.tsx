import { useState, useRef, KeyboardEvent, useEffect } from "react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  allTags: string[];
  placeholder?: string;
  maxTags?: number;
  allowDuplicates?: boolean;
  separator?: string;
}

export default function TagInput({
  value,
  onChange,
  allTags,
  placeholder = "Add tags...",
  maxTags,
  allowDuplicates = false,
}: TagInputProps) {
  // Ensure value is always an array
  const safeValue = value || [];
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Show initial suggestions when input is focused
  useEffect(() => {
    if (isFocused && suggestions.length === 0 && allTags.length > 0) {
      // Show popular/recent tags when input is empty and focused
      const availableTags = allTags
        .filter((tag) => !safeValue.includes(tag));
      setSuggestions(availableTags);
    }
  }, [isFocused, allTags, safeValue, suggestions.length]);

  // Scroll highlighted suggestion into view
  useEffect(() => {
    if (highlightedIndex >= 0 && suggestionsRef.current) {
      const highlightedElement =
        suggestionsRef.current.children[highlightedIndex];
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentInput = e.target.value;
    setInputValue(currentInput);
    setHighlightedIndex(-1);

    if (currentInput) {
      // First show exact matches at the beginning of the tag
      const exactStartMatches = allTags.filter(
        (tag) =>
          tag.toLowerCase().startsWith(currentInput.toLowerCase()) &&
          !safeValue.includes(tag)
      );

      // Then show tags that include the input anywhere
      const includesMatches = allTags.filter(
        (tag) =>
          !tag.toLowerCase().startsWith(currentInput.toLowerCase()) &&
          tag.toLowerCase().includes(currentInput.toLowerCase()) &&
          !safeValue.includes(tag)
      );

      // Combine both lists with exact matches first
      const filteredSuggestions = [
        ...exactStartMatches,
        ...includesMatches,
      ].slice(0, 8);
      setSuggestions(filteredSuggestions);
    } else {
      // When input is empty, show all available tags
      const allAvailableTags = allTags
        .filter((tag) => !safeValue.includes(tag));
      setSuggestions(allAvailableTags);
    }
  };

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (!trimmedTag) return;

    if (maxTags && safeValue.length >= maxTags) return;

    if (!allowDuplicates && safeValue.includes(trimmedTag)) {
      setInputValue("");
      setSuggestions([]);
      return;
    }

    onChange([...safeValue, trimmedTag]);
    setInputValue("");
    setSuggestions([]);
  };

  const removeTag = (tagToRemove: string) => {
    onChange(safeValue.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Handle arrow navigation in dropdown
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        // If a suggestion is highlighted, add that tag
        addTag(suggestions[highlightedIndex]);
        setHighlightedIndex(-1);
      } else if (inputValue) {
        // Otherwise add the current input value
        addTag(inputValue);
      }
    } else if (e.key === ",") {
      e.preventDefault();
      if (inputValue) {
        addTag(inputValue);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSuggestions([]);
      setHighlightedIndex(-1);
      inputRef.current?.blur();
    } else if (e.key === "Backspace" && inputValue === "") {
      if (safeValue.length > 0) {
        removeTag(safeValue[safeValue.length - 1]);
      }
    } else if (e.key === "Tab" && highlightedIndex >= 0) {
      e.preventDefault();
      addTag(suggestions[highlightedIndex]);
      setHighlightedIndex(-1);
    }
  };

  const handleSuggestionClick = (tag: string) => {
    addTag(tag);
    inputRef.current?.focus();
  };

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={`min-h-[40px] px-2 py-1 bg-white border rounded-md transition-all duration-200 flex flex-wrap items-center gap-1.5 cursor-text ${
          isFocused
            ? "border-blue-500 shadow-[0_0_0_2px_rgba(24,144,255,0.2)]"
            : "border-gray-300 hover:border-gray-400"
        } ${maxTags && value.length >= maxTags ? "bg-gray-50" : ""}`}
        onClick={() => inputRef.current?.focus()}
      >
        {safeValue.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md text-sm font-medium transition-all duration-200 hover:bg-blue-100"
          >
            <span className="select-none">{tag}</span>
            <button
              type="button"
              className="ml-1 text-blue-500 hover:text-blue-700 transition-colors duration-150"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            if (suggestions.length === 0 && allTags.length > 0) {
              const availableTags = allTags
                .filter((tag) => !value.includes(tag))
                .slice(0, 8);
              setSuggestions(availableTags);
            }
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[60px] bg-transparent outline-none border-none p-1 text-sm placeholder-gray-400"
          disabled={maxTags ? value.length >= maxTags : false}
        />
      </div>
      {isFocused && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto">
          <ul ref={suggestionsRef} className="py-1">
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors duration-150 flex items-center justify-between ${
                  highlightedIndex === index
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSuggestionClick(suggestion);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <span className="font-medium">{suggestion}</span>
                {highlightedIndex === index && (
                  <kbd className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                    Enter
                  </kbd>
                )}
              </li>
            ))}
            {inputValue && !suggestions.includes(inputValue) && (
              <li
                className={`px-3 py-2 text-sm cursor-pointer transition-colors duration-150 border-t border-gray-100 flex items-center justify-between ${
                  highlightedIndex === suggestions.length
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(inputValue);
                }}
                onMouseEnter={() => setHighlightedIndex(suggestions.length)}
              >
                <span>
                  Add "<strong className="font-medium">{inputValue}</strong>"
                </span>
                {highlightedIndex === suggestions.length && (
                  <kbd className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                    Enter
                  </kbd>
                )}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

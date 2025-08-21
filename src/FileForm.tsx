import { useState, FormEvent, useEffect } from "react";
import { toast } from "sonner";
import TagInput from "./TagInput";
import axios from "axios";

interface File {
  id: number;
  name: string;
  description: string;
  url: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface FileFormProps {
  existingFile?: File | null;
  onClose: () => void;
}

export default function FileForm({ existingFile, onClose }: FileFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  
  // Log for debugging and update tags when existingFile changes
  useEffect(() => {
    console.log("Existing file tags:", existingFile?.tags);
    if (existingFile) {
      setTitle(existingFile.name || '');
      setDescription(existingFile.description || '');
      setTags(existingFile.tags || []);
    } else {
      setTitle("");
      setDescription("");
      setTags([]);
    }
  }, [existingFile]);
  
  // Fetch all tags when component mounts and when new tags are created
  const fetchTags = async () => {
    try {
      const response = await axios.get('/files/tags/all');
      setAllTags(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  useEffect(() => {
    void fetchTags().catch(error => {
      console.error('Failed to fetch tags:', error);
    });
    
    // Listen for tag refresh events
    const handleTagRefresh = () => fetchTags();
    window.addEventListener('tags-updated', handleTagRefresh);
    
    return () => {
      window.removeEventListener('tags-updated', handleTagRefresh);
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (existingFile) {
        // Update existing file
        const response = await axios.put(`/files/${existingFile.id}`, {
          name: title,
          description,
          tags
        });
        
        toast.success("File updated successfully!");
      } else {
        if (!file) {
          toast.error("Please select a file to upload.");
          setIsSubmitting(false);
          return;
        }
        
        // Create form data for file upload
        const formData = new FormData();
        formData.append('file', file as unknown as Blob);
        formData.append('name', title);
        formData.append('description', description);
        formData.append('tags', JSON.stringify(tags));
        
        // Upload file
        await axios.post('/files', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        toast.success("File uploaded successfully!");
      }
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "An error occurred.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">
        {existingFile ? "Edit File" : "Upload a New File"}
      </h2>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700"
          >
            Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
          />
        </div>
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700"
          >
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            rows={3}
          />
        </div>
        <div>
          <label
            htmlFor="tags"
            className="block text-sm font-medium text-gray-700"
          >
            Tags
          </label>
          <TagInput value={tags || []} onChange={setTags} allTags={allTags ?? []} />
        </div>
        {!existingFile && (
          <div>
            <label
              htmlFor="file"
              className="block text-sm font-medium text-gray-700"
            >
              PDF File
            </label>
            <input
              type="file"
              id="file"
              accept="application/pdf"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0] ?? null;
                setFile(selectedFile as unknown as File | null);
              }}
              required
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-hover file:text-white hover:file:bg-primary"
            />
          </div>
        )}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded text-gray-600 bg-gray-100 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}
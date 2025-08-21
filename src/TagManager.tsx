import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";

interface Tag {
  id: number;
  name: string;
  usage_count: number;
  files?: string;
}

interface TagFormProps {
  tag?: Tag;
  onClose: () => void;
  onSave: () => void;
}

const TagForm: React.FC<TagFormProps> = ({ tag, onClose, onSave }) => {
  const [name, setName] = useState(tag?.name || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Tag name is required");
      return;
    }

    setLoading(true);
    try {
      if (tag) {
        // Update existing tag
        await axios.put(`/files/tags/${tag.id}`, { name });
        toast.success("Tag updated successfully");
      } else {
        // Create new tag
        await axios.post("/files/tags", { name });
        toast.success("Tag created successfully");
      }

      // Dispatch event to refresh tags in all components
      window.dispatchEvent(new CustomEvent("tags-updated"));
      onSave();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to save tag");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {tag ? "Edit Tag" : "Create Tag"}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tag Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter tag name"
              maxLength={50}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface TagManagerProps {
  user?: {
    id: number;
    username: string;
    level: string;
  };
}

const TagManager: React.FC<TagManagerProps> = ({ user }) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | undefined>();

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const response = await axios.get("/files/tags");
      console.log(response.data);
      setTags(response.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to fetch tags");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTag(undefined);
    setShowForm(true);
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setShowForm(true);
  };

  const handleDelete = async (tag: Tag) => {
    if (!window.confirm(`Are you sure you want to delete "${tag.name}"?`)) {
      return;
    }

    if (tag.usage_count > 0) {
      toast.error(
        `Cannot delete tag "${tag.name}" as it is used by ${tag.usage_count} file(s)`
      );
      return;
    }

    try {
      await axios.delete(`/files/tags/${tag.id}`);
      toast.success("Tag deleted successfully");
      fetchTags();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete tag");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Tag Management</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage system-wide tags used across all files
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-hover"
        >
          Create Tag
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {tags.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">
              No tags found. Create your first tag to get started.
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tag Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usage Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Files
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tags.map((tag) => (
                <tr key={tag.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {tag.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {tag.usage_count}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {tag.files || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(tag)}
                      className="text-primary hover:text-primary-hover mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(tag)}
                      disabled={tag.usage_count > 0}
                      className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <TagForm
          tag={editingTag}
          onClose={() => setShowForm(false)}
          onSave={() => {
            setShowForm(false);
            fetchTags();
          }}
        />
      )}
    </div>
  );
};

export default TagManager;

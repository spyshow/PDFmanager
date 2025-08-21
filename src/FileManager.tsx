import { useState, useEffect } from "react";
import FileList from "./FileList";
import FileForm from "./FileForm";
import TagFilter from "./TagFilter";
import axios from "axios";
import { toast } from "sonner";

interface User {
  id: number;
  username: string;
  level: string;
}

interface File {
  id: number;
  name: string;
  description: string;
  url: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface FileManagerProps {
  searchQuery: string;
}

export default function FileManager({ searchQuery }: FileManagerProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  // Fetch current user and files when component mounts
  useEffect(() => {
    const fetchCurrentUser = async () => {
      setUserLoading(true);
      try {
        const response = await axios.get("/auth/user");
        setCurrentUser(response.data);
      } catch (error) {
        console.error("Error fetching current user:", error);
        toast.error("Failed to load user information");
      } finally {
        setUserLoading(false);
      }
    };

    void fetchCurrentUser();
  }, []);

  // Fetch files when component mounts or when search/tags change
  useEffect(() => {
    if (!userLoading) {
      const fetchFiles = async () => {
        setLoading(true);
        try {
          let url = "/files";
          const params = new URLSearchParams();

          if (searchQuery) {
            params.append("search", searchQuery);
          }

          if (selectedTags.length > 0 && currentUser?.level !== "viewer") {
            selectedTags.forEach((tag) => params.append("tags", tag));
          }

          if (params.toString()) {
            url += `?${params.toString()}`;
          }

          const response = await axios.get(url);
          setFiles(response.data);
        } catch (error) {
          console.error("Error fetching files:", error);
          toast.error("Failed to load files");
        } finally {
          setLoading(false);
        }
      };

      void fetchFiles();
    }
  }, [searchQuery, selectedTags, currentUser, userLoading]);

  const [isAdding, setIsAdding] = useState(false);

  const handleEdit = (file: File) => {
    // Make sure we have the latest file data with tags
    void fetchFileDetails(file.id);
    setIsAdding(true); // Show the form
  };

  // Fetch complete file details including tags
  const fetchFileDetails = async (fileId: number) => {
    try {
      const response = await axios.get(`/files/${fileId}`);
      setEditingFile(response.data);
    } catch (error) {
      console.error("Error fetching file details:", error);
      toast.error("Failed to load file details");
    }
  };

  const fetchFiles = async () => {
    setLoading(true);
    try {
      let url = "/files";
      const params = new URLSearchParams();

      if (searchQuery) {
        params.append("search", searchQuery);
      }

      if (selectedTags.length > 0 && currentUser?.level !== "viewer") {
        selectedTags.forEach((tag) => params.append("tags", tag));
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await axios.get(url);
      setFiles(response.data);
    } catch (error) {
      console.error("Error fetching files:", error);
      toast.error("Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseForm = () => {
    setIsAdding(false);
    setEditingFile(null);
    // Refresh files after closing the form
    void fetchFiles().catch((error) => {
      console.error("Error refreshing files:", error);
      toast.error("Failed to refresh files");
    });
  };

  const handleDelete = async (fileId: number) => {
    if (!confirm("Are you sure you want to delete this file?")) return;

    try {
      await axios.delete(`/files/${fileId}`);
      toast.success("File deleted successfully");
      void fetchFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file");
    }
  };

  if (userLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  const isViewer = currentUser?.level === "viewer";
  const isUser = currentUser?.level === "user";
  const isAdmin = currentUser?.level === "admin";

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">
          {isViewer ? "All Files" : isAdmin ? "All Files" : "My Files"}
        </h1>
        {!isViewer && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-hover"
          >
            Upload File
          </button>
        )}
      </div>

      {isAdding || editingFile ? (
        <FileForm existingFile={editingFile} onClose={handleCloseForm} />
      ) : (
        <>
          {!isViewer && (
            <TagFilter
              selectedTags={selectedTags}
              setSelectedTags={setSelectedTags}
            />
          )}
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <p className="text-xl">No files found</p>
              {!isViewer && (
                <p className="mt-2">Upload a file to get started</p>
              )}
            </div>
          ) : (
            <FileList
              files={files}
              onEdit={!isViewer ? (file: File) => handleEdit(file) : undefined}
              onDelete={
                !isViewer ? (id: number) => void handleDelete(id) : undefined
              }
              isViewer={isViewer}
            />
          )}
        </>
      )}
    </div>
  );
}

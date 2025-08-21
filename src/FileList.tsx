import { useState } from "react";
import QRCodeModal from "./QRCodeModal";
import { toast } from "sonner";

interface File {
  id: number;
  name: string;
  description: string;
  url: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface FileListProps {
  files: File[];
  onDelete?: (id: number) => void;
  onEdit?: (file: File) => void;
  isViewer?: boolean;
}

export default function FileList({ files, onEdit, onDelete, isViewer }: FileListProps) {
  const [selectedFile, setSelectedFile] = useState<{url: string, title: string} | null>(null);
  const [isQrModalOpen, setQrModalOpen] = useState(false);

  // Loading and empty states are now handled in the FileManager component

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {files.map((file) => (
        <div key={file.id} className="bg-white p-4 rounded shadow">
          <h3 className="font-bold text-lg truncate">{file.name}</h3>
          {file.description && (
            <p className="text-gray-600 text-sm mt-1 line-clamp-2">{file.description}</p>
          )}
          <div className="flex flex-wrap gap-1 my-2">
            {file.tags.map((tag: string, index: number) => (
              <span
                key={index}
                className="bg-gray-200 text-gray-700 px-2 py-1 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className={`flex ${isViewer ? 'justify-center' : 'justify-end'} gap-2 mt-4`}>
            {!isViewer && onEdit && (
              <button
                onClick={() => onEdit(file)}
                className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
              >
                Edit
              </button>
            )}
            {!isViewer && onDelete && (
              <button
                onClick={() => onDelete(file.id)}
                className="text-sm bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
              >
                Delete
              </button>
            )}
            <button
              onClick={() => {
                setSelectedFile({ url: file.url, title: file.name });
                setQrModalOpen(true);
              }}
              className="text-sm bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 disabled:opacity-50"
            >
              QR Code
            </button>
          </div>
        </div>
      ))}
      {isQrModalOpen && selectedFile ? (
        <QRCodeModal
          url={selectedFile.url}
          title={selectedFile.title}
          onClose={() => setQrModalOpen(false)}
        />
      ) : null}
    </div>
  );
}

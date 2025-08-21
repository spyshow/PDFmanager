import { Toaster } from "sonner";
import { useState, useEffect } from "react";
import FileManager from "./FileManager";
import UserManager from "./UserManager";
import TagManager from "./TagManager";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import axios from "axios";

// Set axios default base URL
axios.defaults.baseURL = '/api';

interface User {
  id: number;
  username: string;
  email: string;
  level: string;
}

export default function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'files' | 'users' | 'tags'>('files');
  
  // Check if user is already authenticated on component mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    
    if (token && storedUser) {
      // Set up axios default headers
      axios.defaults.headers.common["x-auth-token"] = token;
      
      // Verify token is valid by making a request to the server
      axios.get("/auth/user")
        .then(response => {
          setUser(response.data);
          setIsAuthenticated(true);
          console.log("useEffect: User object from /auth/user:", response.data);
        })
        .catch(error => {
          console.error("Token validation error:", error);
          // Token is invalid, clear localStorage
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          delete axios.defaults.headers.common["x-auth-token"];
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);
  
  const handleSignIn = (token: string, user: any) => {
    console.log("handleSignIn: User object received:", user);
    // Set up axios default headers
    axios.defaults.headers.common["x-auth-token"] = token;
    setUser(user);
    setIsAuthenticated(true);
  };
  
  const handleSignOut = () => {
    // Remove axios default headers
    delete axios.defaults.headers.common["x-auth-token"];
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4 gap-4">
        <h2 className="text-xl font-semibold text-primary">PDF Manager</h2>
        {isAuthenticated && (
          <div className="flex-grow relative">
            <input
              type="text"
              placeholder="Search by title or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-md mx-auto px-4 py-2 border rounded-md focus:outline-none focus:ring-primary focus:border-primary"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
                style={{
                  right: `calc(50% - 1.25rem - 11rem)`,
                }}
              >
                &times;
              </button>
            ) : null}
          </div>
        )}
        {isAuthenticated && (
          <div className="flex items-center gap-3">
            {user?.level === 'admin' && (
              <div className="relative">
                <select
                  value={activeView}
                  onChange={(e) => setActiveView(e.target.value as 'files' | 'users' | 'tags')}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer hover:border-gray-400 transition-colors"
                >
                  <option value="files">📁 Files</option>
                  <option value="users">👥 Users</option>
                  {user?.level === 'admin' && (
                    <option value="tags">🏷️ Tags</option>
                  )}
                </select>
              </div>
            )}
            <span className="text-sm text-gray-600">Hello, {user?.username} ({user?.level})</span>
            <SignOutButton onSignOut={handleSignOut} />
          </div>
        )}
      </header>
      <main className="flex-1 p-8">
        <div className="w-full max-w-4xl mx-auto">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <p>Loading...</p>
            </div>
          ) : isAuthenticated ? (
            activeView === 'files' ? (
              <FileManager searchQuery={searchQuery} />
            ) : activeView === 'users' ? (
              <UserManager />
            ) : (
              <TagManager user={user} />
            )
          ) : (
            <div className="flex justify-center items-center">
              <SignInForm onSignIn={handleSignIn} />
            </div>
          )}
        </div>
      </main>
      <Toaster />
    </div>
  );
}

// We're now using FileManager directly in the main App component

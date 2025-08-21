import { toast } from "sonner";

interface SignOutButtonProps {
  onSignOut: () => void;
}

export function SignOutButton({ onSignOut }: SignOutButtonProps) {
  const handleSignOut = () => {
    // Remove token and user from localStorage
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    
    // Call the onSignOut callback
    onSignOut();
    
    toast.success("Signed out successfully");
  };

  return (
    <button
      onClick={handleSignOut}
      className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-1 px-3 rounded transition-colors"
    >
      Sign Out
    </button>
  );
}

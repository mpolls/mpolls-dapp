import { useState, useEffect } from "react";
import { pollsContract } from "./utils/contractInteraction";
import { parseBlockchainError, logError } from "./utils/errorHandling";
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import LinkIcon from '@mui/icons-material/Link';
import RefreshIcon from '@mui/icons-material/Refresh';

interface CreateProjectProps {
  onBack: () => void;
  onProjectCreated: () => void;
  editingProject?: {
    id: number;
    name: string;
    description: string;
    creator: string;
  } | null;
}

const CreateProject = ({ onBack, onProjectCreated, editingProject }: CreateProjectProps) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    tags: "",
    visibility: "public" as "public" | "private"
  });

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Wallet connection state
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletName, setWalletName] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const isEditMode = !!editingProject;

  useEffect(() => {
    checkWalletConnection();

    // Pre-populate form when editing
    if (editingProject) {
      setFormData({
        name: editingProject.name,
        description: editingProject.description,
        tags: "",
        visibility: "public"
      });
    }
  }, [editingProject]);

  const checkWalletConnection = async () => {
    const connected = await pollsContract.isWalletConnected();
    setIsWalletConnected(connected);
    if (connected) {
      const address = await pollsContract.getWalletAddress();
      const name = pollsContract.getWalletName();
      setWalletAddress(address || "");
      setWalletName(name || "");
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    setError("");
    try {
      const connected = await pollsContract.connectWallet();
      if (connected) {
        setIsWalletConnected(true);
        const address = await pollsContract.getWalletAddress();
        const name = pollsContract.getWalletName();
        setWalletAddress(address || "");
        setWalletName(name || "");
        setSuccess(`Wallet connected successfully! Using ${name || 'wallet'}.`);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("Failed to connect wallet. Please make sure you have MassaStation or Bearby wallet installed and unlocked.");
      }
    } catch (err) {
      logError(err, { action: 'connecting wallet' });
      const friendlyError = parseBlockchainError(err, { action: 'connecting wallet' });
      setError(`${friendlyError.message} ${friendlyError.suggestion}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const validateForm = () => {
    if (!formData.name.trim()) return "Project name is required";
    if (formData.name.length < 3) return "Project name must be at least 3 characters";
    if (formData.name.length > 50) return "Project name must be less than 50 characters";
    if (!formData.description.trim()) return "Description is required";
    if (formData.description.length < 10) return "Description must be at least 10 characters";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("📝 Form submitted! Wallet connected:", isWalletConnected);

    const validationError = validateForm();
    if (validationError) {
      console.log("❌ Validation error:", validationError);
      setError(validationError);
      return;
    }

    if (!isWalletConnected) {
      console.log("❌ Wallet not connected");
      setError("Please connect your wallet first to create a project.");
      return;
    }

    console.log("✅ Validation passed, starting project creation...");
    setIsCreating(true);
    setError("");
    setSuccess("");

    try {
      if (isEditMode && editingProject) {
        console.log("🔄 Updating project on blockchain:", formData);

        // Update existing project
        await pollsContract.updateProject(editingProject.id.toString(), {
          name: formData.name,
          description: formData.description
        });

        console.log(`✅ Project ${editingProject.id} updated successfully`);

        setSuccess(`Project updated successfully! Redirecting...`);
      } else {
        console.log("🚀 Creating project on blockchain:", formData);

        // Create new project
        const projectId = await pollsContract.createProject({
          name: formData.name,
          description: formData.description
        });

        console.log(`✅ Project created successfully with ID: ${projectId}`);

        setSuccess(`Project created successfully! Project ID: ${projectId}. Redirecting...`);
      }

      // Reset form
      setFormData({
        name: "",
        description: "",
        tags: "",
        visibility: "public"
      });

      // Redirect after success to see the project
      setTimeout(() => {
        onProjectCreated();
      }, 2000);

    } catch (err) {
      console.error(`❌ Error ${isEditMode ? 'updating' : 'creating'} project:`, err);
      logError(err, { action: `${isEditMode ? 'updating' : 'creating'} project` });
      const friendlyError = parseBlockchainError(err, { action: `${isEditMode ? 'updating' : 'creating'} project` });
      setError(`${friendlyError.message} ${friendlyError.suggestion}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="create-project">
      <div className="create-project-container">
        <button className="back-btn" onClick={onBack}>
          ← Back to Projects
        </button>

        <div className="create-project-content">
          <h1>
            <FolderIcon sx={{ fontSize: 32, marginRight: 1, verticalAlign: 'middle' }} />
            {isEditMode ? 'Edit Project' : 'Create New Project'}
          </h1>
          <p className="subtitle">
            {isEditMode
              ? 'Update your project details'
              : 'Organize your polls under a project for better management'
            }
          </p>

          {error && (
            <div className="error-message">
              <ErrorIcon sx={{ fontSize: 20, marginRight: 0.5, verticalAlign: 'middle' }} />
              {error}
            </div>
          )}

          {success && (
            <div className="success-message">
              <CheckCircleIcon sx={{ fontSize: 20, marginRight: 0.5, verticalAlign: 'middle' }} />
              {success}
            </div>
          )}

          {/* Wallet Connection Section */}
          <div className="wallet-section">
            <h2>Wallet Connection</h2>
            {!isWalletConnected ? (
              <div className="wallet-connect">
                <p>Connect your Massa wallet to create projects on the blockchain</p>
                <button
                  type="button"
                  className="connect-wallet-btn"
                  onClick={connectWallet}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <RefreshIcon sx={{ fontSize: 18, marginRight: 0.5, verticalAlign: 'middle' }} /> Connecting...
                    </>
                  ) : (
                    <>
                      <LinkIcon sx={{ fontSize: 18, marginRight: 0.5, verticalAlign: 'middle' }} /> Connect Wallet
                    </>
                  )}
                </button>
                <small>Make sure you have MassaStation or Bearby wallet installed and unlocked</small>
              </div>
            ) : (
              <div className="wallet-connected">
                <p><CheckCircleIcon sx={{ fontSize: 20, marginRight: 0.5, verticalAlign: 'middle' }} /> Wallet Connected</p>
                <div className="wallet-info">
                  <div className="wallet-name">
                    <strong>Wallet:</strong> {walletName || "Unknown"}
                  </div>
                  <div className="wallet-address">
                    <strong>Account:</strong> {walletAddress}
                  </div>
                </div>
              </div>
            )}
          </div>

          <form className="project-form" onSubmit={handleSubmit}>
            {/* Basic Information */}
            <div className="form-section">
              <h2>Basic Information</h2>

              <div className="form-group">
                <label htmlFor="name">Project Name *</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter project name"
                  maxLength={50}
                />
                <small>{formData.name.length}/50 characters</small>
              </div>

              <div className="form-group">
                <label htmlFor="description">Description *</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your project and its purpose"
                  rows={4}
                  maxLength={500}
                />
                <small>{formData.description.length}/500 characters</small>
              </div>

              <div className="form-group">
                <label htmlFor="tags">Tags (Optional)</label>
                <input
                  type="text"
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="e.g., governance, feedback, community (comma-separated)"
                />
                <small>Add tags to help categorize your project</small>
              </div>
            </div>

            {/* Visibility Settings */}
            <div className="form-section">
              <h2>Visibility Settings</h2>

              <div className="form-group">
                <label>Who can view this project?</label>
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={formData.visibility === "public"}
                      onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value as "public" | "private" }))}
                    />
                    <div className="radio-content">
                      <span className="radio-title">Public</span>
                      <span className="radio-description">Anyone can view this project and its polls</span>
                    </div>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="visibility"
                      value="private"
                      checked={formData.visibility === "private"}
                      onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value as "public" | "private" }))}
                    />
                    <div className="radio-content">
                      <span className="radio-title">Private</span>
                      <span className="radio-description">Only you and invited members can view this project</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="info-box">
              <h3>📝 Project Benefits</h3>
              <ul>
                <li>Organize related polls together</li>
                <li>Better analytics and reporting</li>
                <li>Easier collaboration with team members</li>
                <li>Professional presentation for your polls</li>
              </ul>
            </div>

            {/* Submit */}
            <div className="form-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={onBack}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="create-project-submit"
                disabled={isCreating || !isWalletConnected}
                onClick={() => console.log(`🖱️ ${isEditMode ? 'Update' : 'Create'} Project button clicked! Disabled:`, isCreating || !isWalletConnected)}
              >
                {isCreating
                  ? (isEditMode ? "Updating Project..." : "Creating Project...")
                  : !isWalletConnected
                    ? `Connect Wallet to ${isEditMode ? 'Update' : 'Create'} Project`
                    : (isEditMode ? "Update Project" : "Create Project")
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateProject;
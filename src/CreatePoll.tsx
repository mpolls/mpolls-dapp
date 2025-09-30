import { useState, useEffect } from "react";
import { pollsContract, PollCreationParams, ContractProject } from "./utils/contractInteraction";
import { parseBlockchainError, logError } from "./utils/errorHandling";
import PlaceIcon from '@mui/icons-material/Place';
import LinkIcon from '@mui/icons-material/Link';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import FolderIcon from '@mui/icons-material/Folder';

interface CreatePollProps {
  onBack: () => void;
}

const CreatePoll = ({ onBack }: CreatePollProps) => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    options: ["", ""],
    duration: 7, // days
    entryFee: 0,
    votingFee: 0,
    rewardPool: 0,
    allowList: "",
    contestType: "open" as "open" | "allowlist",
    viewType: "text" as "text" | "gallery",
    projectId: 0 // 0 means no project assigned
  });

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletName, setWalletName] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [projects, setProjects] = useState<ContractProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  useEffect(() => {
    checkWalletConnection();
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const allProjects = await pollsContract.getAllProjects();
      setProjects(allProjects);
    } catch (err) {
      console.error("Error loading projects:", err);
      // Don't show error to user, just fail silently
    } finally {
      setIsLoadingProjects(false);
    }
  };

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

  const addOption = () => {
    if (formData.options.length < 10) {
      setFormData(prev => ({
        ...prev,
        options: [...prev.options, ""]
      }));
    }
  };

  const removeOption = (index: number) => {
    if (formData.options.length > 2) {
      setFormData(prev => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index)
      }));
    }
  };

  const updateOption = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((option, i) => i === index ? value : option)
    }));
  };

  const validateForm = () => {
    if (!formData.title.trim()) return "Title is required";
    if (!formData.description.trim()) return "Description is required";
    if (formData.options.some(opt => !opt.trim())) return "All options must be filled";
    if (formData.options.length < 2) return "At least 2 options required";
    if (formData.duration < 1) return "Duration must be at least 1 day";
    return "";
  };

  const createPoll = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!isWalletConnected) {
      setError("Please connect your wallet first to create a poll.");
      return;
    }

    setIsCreating(true);
    setError("");
    setSuccess("");

    try {
      // Prepare contract call parameters
      const durationInSeconds = formData.duration * 24 * 60 * 60; // Convert days to seconds
      const filteredOptions = formData.options.filter(opt => opt.trim());

      const pollParams: PollCreationParams = {
        title: formData.title,
        description: formData.description,
        options: filteredOptions,
        durationInSeconds,
        projectId: formData.projectId > 0 ? formData.projectId : undefined
      };
      console.log("🚀 Creating poll with parameters:", pollParams);

      // Call the contract to create the poll
      const pollId = await pollsContract.createPoll(pollParams);

      setSuccess(`Poll created successfully! Poll ID: ${pollId}. Redirecting to polls list...`);
      
      // Reset form
      setFormData({
        title: "",
        description: "",
        options: ["", ""],
        duration: 7,
        entryFee: 0,
        votingFee: 0,
        rewardPool: 0,
        allowList: "",
        contestType: "open",
        viewType: "text",
        projectId: 0
      });

      // Redirect to polls list after a short delay to show the success message
      setTimeout(() => {
        onBack(); // This will navigate back to the polls list
      }, 2000); // 2 second delay

    } catch (err) {
      logError(err, { action: 'creating poll' });
      const friendlyError = parseBlockchainError(err, { action: 'creating poll' });
      setError(`${friendlyError.message} ${friendlyError.suggestion}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="create-poll">
      <div className="create-poll-container">
        <button className="back-btn" onClick={onBack}>
          ← Back to Polls
        </button>

        <div className="create-poll-content">
          <h1>Create New Poll</h1>
          <p className="subtitle">Design your decentralized poll or contest on the Massa blockchain</p>
          
          {/* Contract Address Display */}
          <div className="contract-info">
            <h3><PlaceIcon sx={{ fontSize: 20, marginRight: 0.5, verticalAlign: 'middle' }} /> Contract Information</h3>
            <div className="contract-address">
              <strong>Address:</strong> {pollsContract.getContractAddress()}
            </div>
            <div className="contract-network">
              <strong>Network:</strong> Massa Buildnet
            </div>
            <a 
              href={pollsContract.getExplorerUrl()}
              target="_blank" 
              rel="noopener noreferrer"
              className="explorer-link"
            >
              <LinkIcon sx={{ fontSize: 16, marginRight: 0.5, verticalAlign: 'middle' }} /> View on Explorer
            </a>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          {/* Wallet Connection Section */}
          <div className="wallet-section">
            <h2>Wallet Connection</h2>
            {!isWalletConnected ? (
              <div className="wallet-connect">
                <p>Connect your Massa wallet to create polls on the blockchain</p>
                <button
                  type="button"
                  className="connect-wallet-btn"
                  onClick={connectWallet}
                  disabled={isConnecting}
                >
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
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

          <form className="poll-form" onSubmit={(e) => { e.preventDefault(); createPoll(); }}>
            {/* Basic Information */}
            <div className="form-section">
              <h2>Basic Information</h2>

              <div className="form-group">
                <label htmlFor="title">Poll Title *</label>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter your poll title"
                  maxLength={100}
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description *</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your poll or contest"
                  rows={4}
                  maxLength={500}
                />
              </div>

              <div className="form-group">
                <label htmlFor="project">
                  <FolderIcon sx={{ fontSize: 18, marginRight: 0.5, verticalAlign: 'middle' }} />
                  Project (Optional)
                </label>
                <select
                  id="project"
                  value={formData.projectId}
                  onChange={(e) => setFormData(prev => ({ ...prev, projectId: parseInt(e.target.value) }))}
                  disabled={isLoadingProjects}
                >
                  <option value={0}>No Project (Standalone Poll)</option>
                  {projects.map(project => (
                    <option key={project.id} value={parseInt(project.id)}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <small>
                  {isLoadingProjects ? "Loading projects..." :
                   projects.length === 0 ? "No projects available. Create a project first to organize your polls." :
                   "Organize this poll under a project for better management"}
                </small>
              </div>
            </div>

            {/* Contest Type */}
            <div className="form-section">
              <h2>Contest Type</h2>
              
              <div className="form-group">
                <label>Who can participate?</label>
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="contestType"
                      value="open"
                      checked={formData.contestType === "open"}
                      onChange={(e) => setFormData(prev => ({ ...prev, contestType: e.target.value as "open" | "allowlist" }))}
                    />
                    <span>Open to everyone</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="contestType"
                      value="allowlist"
                      checked={formData.contestType === "allowlist"}
                      onChange={(e) => setFormData(prev => ({ ...prev, contestType: e.target.value as "open" | "allowlist" }))}
                    />
                    <span>Allowlist only</span>
                  </label>
                </div>
              </div>

              {formData.contestType === "allowlist" && (
                <div className="form-group">
                  <label htmlFor="allowList">Allowed Addresses</label>
                  <textarea
                    id="allowList"
                    value={formData.allowList}
                    onChange={(e) => setFormData(prev => ({ ...prev, allowList: e.target.value }))}
                    placeholder="Enter Massa addresses, one per line"
                    rows={4}
                  />
                </div>
              )}

              <div className="form-group">
                <label>View Type</label>
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="viewType"
                      value="text"
                      checked={formData.viewType === "text"}
                      onChange={(e) => setFormData(prev => ({ ...prev, viewType: e.target.value as "text" | "gallery" }))}
                    />
                    <span>Text view</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="viewType"
                      value="gallery"
                      checked={formData.viewType === "gallery"}
                      onChange={(e) => setFormData(prev => ({ ...prev, viewType: e.target.value as "text" | "gallery" }))}
                    />
                    <span>Gallery view</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="form-section">
              <h2>Poll Options</h2>
              
              {formData.options.map((option, index) => (
                <div key={index} className="option-group">
                  <label htmlFor={`option-${index}`}>Option {index + 1} *</label>
                  <div className="option-input-group">
                    <input
                      type="text"
                      id={`option-${index}`}
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Enter option ${index + 1}`}
                      maxLength={100}
                    />
                    {formData.options.length > 2 && (
                      <button
                        type="button"
                        className="remove-option-btn"
                        onClick={() => removeOption(index)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {formData.options.length < 10 && (
                <button
                  type="button"
                  className="add-option-btn"
                  onClick={addOption}
                >
                  + Add Option
                </button>
              )}
            </div>

            {/* Duration & Fees */}
            <div className="form-section">
              <h2>Duration & Economics</h2>
              
              <div className="form-group">
                <label htmlFor="duration">Poll Duration (days) *</label>
                <input
                  type="number"
                  id="duration"
                  value={formData.duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 1 }))}
                  min="1"
                  max="365"
                />
              </div>

              <div className="form-group">
                <label htmlFor="entryFee">Entry Fee (MASSA)</label>
                <input
                  type="number"
                  id="entryFee"
                  value={formData.entryFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, entryFee: parseFloat(e.target.value) || 0 }))}
                  min="0"
                  step="0.001"
                />
              </div>

              <div className="form-group">
                <label htmlFor="votingFee">Voting Fee (MASSA)</label>
                <input
                  type="number"
                  id="votingFee"
                  value={formData.votingFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, votingFee: parseFloat(e.target.value) || 0 }))}
                  min="0"
                  step="0.001"
                />
              </div>

              <div className="form-group">
                <label htmlFor="rewardPool">Initial Reward Pool (MASSA)</label>
                <input
                  type="number"
                  id="rewardPool"
                  value={formData.rewardPool}
                  onChange={(e) => setFormData(prev => ({ ...prev, rewardPool: parseFloat(e.target.value) || 0 }))}
                  min="0"
                  step="0.001"
                />
                <small>Optional: Add your own funds to the reward pool</small>
              </div>
            </div>

            {/* Fee Split Info */}
            <div className="fee-info">
              <h3><AttachMoneyIcon sx={{ fontSize: 22, marginRight: 0.5, verticalAlign: 'middle' }} /> Revenue Split</h3>
              <p>You keep <strong>70%</strong> of all fees collected. Massa Polls takes 30% to maintain the platform.</p>
            </div>

            {/* Submit */}
            <div className="form-actions">
              <button
                type="submit"
                className="create-poll-submit"
                disabled={isCreating || !isWalletConnected}
              >
                {isCreating ? "Creating Poll..." : !isWalletConnected ? "Connect Wallet to Create Poll" : "Create Poll"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreatePoll;
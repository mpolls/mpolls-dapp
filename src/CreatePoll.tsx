import { useState, useEffect } from "react";
import { pollsContract, PollCreationParams, ContractProject } from "./utils/contractInteraction";
import { parseBlockchainError, logError } from "./utils/errorHandling";
import PlaceIcon from '@mui/icons-material/Place';
import LinkIcon from '@mui/icons-material/Link';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import FolderIcon from '@mui/icons-material/Folder';
import { AIChatBox } from './components/AIChatBox';
import { PollParameters } from './api/openai';

interface CreatePollProps {
  onBack: () => void;
}

const CreatePoll = ({ onBack }: CreatePollProps) => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    options: ["", ""],
    duration: 7, // days
    allowList: "",
    contestType: "open" as "open" | "allowlist",
    viewType: "text" as "text" | "gallery",
    projectId: 0, // 0 means no project assigned
    // New economics fields
    fundingType: "self" as "self" | "community" | "treasury",
    distributionMode: "equal" as "equal" | "fixed" | "weighted",
    distributionType: "manual-pull" as "manual-pull" | "manual-push" | "autonomous",
    rewardPool: 0, // Initial reward pool amount
    fixedRewardAmount: 0, // For fixed reward mode
    fundingGoal: 0 // For community-funded polls
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
  const [creationMode, setCreationMode] = useState<'form' | 'ai-chat'>('form');

  useEffect(() => {
    checkWalletConnection();
    loadProjects();

    // Check if there's a pre-selected project from sessionStorage
    const selectedProjectId = sessionStorage.getItem('selectedProjectId');
    if (selectedProjectId) {
      setFormData(prev => ({
        ...prev,
        projectId: parseInt(selectedProjectId)
      }));
      // Clear from sessionStorage after reading
      sessionStorage.removeItem('selectedProjectId');
    }
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

  const handleAIPollReady = (params: PollParameters) => {
    // Populate form data from AI-extracted parameters
    setFormData(prev => ({
      ...prev,
      title: params.title || "",
      description: params.description || "",
      options: params.options || ["", ""],
      duration: params.duration || 7,
      fundingType: (params.fundingType || "self") as "self" | "community" | "treasury",
      distributionMode: (params.distributionMode || "equal") as "equal" | "fixed" | "weighted",
      distributionType: (params.distributionType || "manual-pull") as "manual-pull" | "manual-push" | "autonomous",
      rewardPool: params.rewardPool || 0,
      fixedRewardAmount: params.fixedRewardAmount || 0,
      fundingGoal: params.fundingGoal || 0,
    }));

    // Switch to form mode to review and submit
    setCreationMode('form');
    setSuccess("Poll parameters loaded from AI! Review and submit below.");

    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

      // Map frontend values to contract enum values
      const fundingTypeMap = { "self": 0, "community": 1, "treasury": 2 };
      const distributionModeMap = { "equal": 0, "fixed": 1, "weighted": 2 };
      const distributionTypeMap = { "manual-pull": 0, "manual-push": 1, "autonomous": 2 };

      const pollParams: PollCreationParams = {
        title: formData.title,
        description: formData.description,
        options: filteredOptions,
        durationInSeconds,
        projectId: formData.projectId > 0 ? formData.projectId : undefined,
        fundingType: fundingTypeMap[formData.fundingType],
        distributionMode: distributionModeMap[formData.distributionMode],
        distributionType: distributionTypeMap[formData.distributionType],
        fixedRewardAmount: formData.fixedRewardAmount,
        fundingGoal: formData.fundingGoal,
        rewardPoolAmount: formData.rewardPool // Initial funding for self-funded polls
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
        allowList: "",
        contestType: "open",
        viewType: "text",
        projectId: 0,
        fundingType: "self",
        distributionMode: "equal",
        distributionType: "manual-pull",
        rewardPool: 0,
        fixedRewardAmount: 0,
        fundingGoal: 0
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

          {/* Creation Mode Tabs */}
          <div className="creation-mode-tabs">
            <button
              className={`mode-tab ${creationMode === 'form' ? 'active' : ''}`}
              onClick={() => setCreationMode('form')}
            >
              Manual Form
            </button>
            <button
              className={`mode-tab ${creationMode === 'ai-chat' ? 'active' : ''}`}
              onClick={() => setCreationMode('ai-chat')}
            >
              AI Chat
            </button>
          </div>

          {/* AI Chat Mode */}
          {creationMode === 'ai-chat' && (
            <div className="ai-chat-mode">
              <AIChatBox onPollParametersReady={handleAIPollReady} />
            </div>
          )}

          {/* Manual Form Mode */}
          {creationMode === 'form' && (
            <>
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

            {/* Duration & Economics */}
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
                <label>Funding Type</label>
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="fundingType"
                      value="self"
                      checked={formData.fundingType === "self"}
                      onChange={(e) => setFormData(prev => ({ ...prev, fundingType: e.target.value as "self" | "community" | "treasury" }))}
                    />
                    <span>Self-Funded</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="fundingType"
                      value="community"
                      checked={formData.fundingType === "community"}
                      onChange={(e) => setFormData(prev => ({ ...prev, fundingType: e.target.value as "self" | "community" | "treasury" }))}
                    />
                    <span>Community-Funded</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="fundingType"
                      value="treasury"
                      checked={formData.fundingType === "treasury"}
                      onChange={(e) => setFormData(prev => ({ ...prev, fundingType: e.target.value as "self" | "community" | "treasury" }))}
                    />
                    <span>Treasury-Funded</span>
                  </label>
                </div>
                <small>
                  {formData.fundingType === "self" && "You can fund the poll after creation or during the poll lifetime"}
                  {formData.fundingType === "community" && "Anyone can contribute funds to this poll before it ends"}
                  {formData.fundingType === "treasury" && "Requires admin approval before poll can be funded"}
                </small>
              </div>

              {formData.fundingType === "self" && (
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
                  <small>Optional: Add funds now or fund later</small>
                </div>
              )}

              {formData.fundingType === "community" && (
                <div className="form-group">
                  <label htmlFor="fundingGoal">Funding Goal (MASSA)</label>
                  <input
                    type="number"
                    id="fundingGoal"
                    value={formData.fundingGoal}
                    onChange={(e) => setFormData(prev => ({ ...prev, fundingGoal: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    step="0.001"
                  />
                  <small>Target amount for community contributions</small>
                </div>
              )}

              <div className="form-group">
                <label>Distribution Mode</label>
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="distributionMode"
                      value="equal"
                      checked={formData.distributionMode === "equal"}
                      onChange={(e) => setFormData(prev => ({ ...prev, distributionMode: e.target.value as "equal" | "fixed" | "weighted" }))}
                    />
                    <span>Equal Split</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="distributionMode"
                      value="fixed"
                      checked={formData.distributionMode === "fixed"}
                      onChange={(e) => setFormData(prev => ({ ...prev, distributionMode: e.target.value as "equal" | "fixed" | "weighted" }))}
                    />
                    <span>Fixed Reward</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="distributionMode"
                      value="weighted"
                      checked={formData.distributionMode === "weighted"}
                      onChange={(e) => setFormData(prev => ({ ...prev, distributionMode: e.target.value as "equal" | "fixed" | "weighted" }))}
                    />
                    <span>Weighted Quality</span>
                  </label>
                </div>
                <small>
                  {formData.distributionMode === "equal" && "Reward pool split equally among all voters"}
                  {formData.distributionMode === "fixed" && "Fixed amount per voter until pool depletes"}
                  {formData.distributionMode === "weighted" && "Weighted by response quality (for surveys)"}
                </small>
              </div>

              {formData.distributionMode === "fixed" && (
                <div className="form-group">
                  <label htmlFor="fixedRewardAmount">Fixed Reward per Voter (MASSA)</label>
                  <input
                    type="number"
                    id="fixedRewardAmount"
                    value={formData.fixedRewardAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, fixedRewardAmount: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    step="0.001"
                  />
                  <small>Amount each voter receives (first-come, first-served)</small>
                </div>
              )}

              <div className="form-group">
                <label>Distribution Type</label>
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="distributionType"
                      value="manual-pull"
                      checked={formData.distributionType === "manual-pull"}
                      onChange={(e) => setFormData(prev => ({ ...prev, distributionType: e.target.value as "manual-pull" | "manual-push" | "autonomous" }))}
                    />
                    <span>Manual Pull</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="distributionType"
                      value="manual-push"
                      checked={formData.distributionType === "manual-push"}
                      onChange={(e) => setFormData(prev => ({ ...prev, distributionType: e.target.value as "manual-pull" | "manual-push" | "autonomous" }))}
                    />
                    <span>Manual Push</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="distributionType"
                      value="autonomous"
                      checked={formData.distributionType === "autonomous"}
                      onChange={(e) => setFormData(prev => ({ ...prev, distributionType: e.target.value as "manual-pull" | "manual-push" | "autonomous" }))}
                    />
                    <span>Autonomous</span>
                  </label>
                </div>
                <small>
                  {formData.distributionType === "manual-pull" && "Voters claim their rewards after poll ends"}
                  {formData.distributionType === "manual-push" && "You trigger reward distribution to all voters"}
                  {formData.distributionType === "autonomous" && "Automatic distribution by smart contract when poll ends"}
                </small>
              </div>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatePoll;
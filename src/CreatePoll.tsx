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
  // Calculate default end date/time (7 days from now)
  const getDefaultEndDateTime = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
  };

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    options: ["", ""],
    duration: 7, // days (kept for backward compatibility, will be calculated from endDateTime)
    endDateTime: getDefaultEndDateTime(), // New field for date/time picker
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
    fundingGoal: 0, // For community-funded polls
    // New reward token fields
    rewardTokenType: "native" as "native" | "custom", // Default to MASSA token
    voteRewardAmount: 10 // Reward amount per respondent (default 10 tokens)
  });

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [projects, setProjects] = useState<ContractProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [creationMode, setCreationMode] = useState<'form' | 'ai-chat'>('form');

  // Multi-step form state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

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

  const validateStep = (step: number): string | null => {
    setError("");

    if (step === 1) {
      // Validate Step 1: Basic Info
      if (!formData.title.trim()) return "Poll title is required";
      if (!formData.description.trim()) return "Poll description is required";
      if (!formData.endDateTime) return "End date/time is required";

      const endDate = new Date(formData.endDateTime);
      const now = new Date();
      if (endDate <= now) return "End date/time must be in the future";
    }

    if (step === 2) {
      // Validate Step 2: Options
      const validOptions = formData.options.filter(opt => opt.trim());
      if (validOptions.length < 2) return "At least 2 options are required";
      if (validOptions.length > 10) return "Maximum 10 options allowed";
    }

    if (step === 3) {
      // Validate Step 3: Economics
      if (formData.distributionMode === "fixed" && formData.fixedRewardAmount <= 0) {
        return "Fixed reward amount must be greater than 0";
      }
      if (formData.fundingType === "community" && formData.fundingGoal <= 0) {
        return "Funding goal must be greater than 0 for community-funded polls";
      }
    }

    return null;
  };

  const nextStep = () => {
    const validationError = validateStep(currentStep);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      setError("");
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError("");
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
      // Calculate duration from endDateTime
      const endDate = new Date(formData.endDateTime);
      const now = new Date();
      const durationInSeconds = Math.floor((endDate.getTime() - now.getTime()) / 1000); // Convert milliseconds to seconds

      if (durationInSeconds <= 0) {
        setError("End date/time must be in the future");
        setIsCreating(false);
        return;
      }

      const filteredOptions = formData.options.filter(opt => opt.trim());

      // Map frontend values to contract enum values
      const fundingTypeMap = { "self": 0, "community": 1, "treasury": 2 };
      const distributionModeMap = { "equal": 0, "fixed": 1, "weighted": 2 };
      const distributionTypeMap = { "manual-pull": 0, "manual-push": 1, "autonomous": 2 };
      const rewardTokenTypeMap = { "native": 0, "custom": 1 };

      // Use the rewardPool specified by the user
      // For native MASSA, this will be transferred from the user's wallet
      const rewardPoolAmount = formData.rewardPool;

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
        rewardPoolAmount: rewardPoolAmount,
        rewardTokenType: rewardTokenTypeMap[formData.rewardTokenType],
        voteRewardAmount: formData.voteRewardAmount,
        createPollRewardAmount: 0 // Poll creators don't receive rewards - they fund the poll for respondents
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
        endDateTime: getDefaultEndDateTime(),
        allowList: "",
        contestType: "open",
        viewType: "text",
        projectId: 0,
        fundingType: "self",
        distributionMode: "equal",
        distributionType: "manual-pull",
        rewardPool: 0,
        fixedRewardAmount: 0,
        fundingGoal: 0,
        rewardTokenType: "native",
        voteRewardAmount: 10
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

          {/* Wallet Connection Notice */}
          {!isWalletConnected && (
            <div className="wallet-notice">
              <p>Please connect your wallet using the "Connect Wallet" button in the header to create polls.</p>
            </div>
          )}

          <form className="poll-form" onSubmit={(e) => {
            e.preventDefault();
            // Only allow submission on the last step
            if (currentStep === totalSteps) {
              createPoll();
            } else {
              // On other steps, pressing Enter should advance to next step
              nextStep();
            }
          }}>
            {/* Step Progress Indicator */}
            <div className="step-progress">
              <div className="step-progress-bar">
                <div
                  className="step-progress-fill"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                />
              </div>
              <div className="step-indicators">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`step-indicator ${currentStep >= step ? 'active' : ''} ${currentStep === step ? 'current' : ''}`}
                  >
                    <div className="step-number">{step}</div>
                    <div className="step-label">
                      {step === 1 && 'Basic Info'}
                      {step === 2 && 'Options'}
                      {step === 3 && 'Rewards'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 1: Basic Information & Duration */}
            {currentStep === 1 && (
              <div className="form-step">
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

                  <div className="form-group">
                    <label htmlFor="endDateTime">Poll End Date & Time *</label>
                    <input
                      type="datetime-local"
                      id="endDateTime"
                      value={formData.endDateTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDateTime: e.target.value }))}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                    <small>
                      {formData.endDateTime ? (
                        <>
                          Poll will end on <strong>{new Date(formData.endDateTime).toLocaleString()}</strong>
                          {' '}({Math.max(0, Math.floor((new Date(formData.endDateTime).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days,
                          {' '}{Math.max(0, Math.floor(((new Date(formData.endDateTime).getTime() - Date.now()) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)))} hours from now)
                        </>
                      ) : (
                        'Select when the poll should end and stop accepting votes'
                      )}
                    </small>
                  </div>
                </div>

                <div className="form-section">
                  <h2>Poll Type</h2>

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
                </div>
              </div>
            )}

            {/* Step 2: Poll Options */}
            {currentStep === 2 && (
              <div className="form-step">
                <div className="form-section">
                  <h2>Poll Options</h2>
                  <p className="section-description">Add at least 2 options for your poll (maximum 10)</p>

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
              </div>
            )}

            {/* Step 3: Rewards & Economics Configuration */}
            {currentStep === 3 && (
              <div className="form-step">
                <div className="form-section">
                  <h2>Funding Configuration</h2>

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
                      {formData.fundingType === "self" && "You fund the poll upfront with MASSA tokens"}
                      {formData.fundingType === "community" && "Anyone can contribute funds to this poll before it ends"}
                      {formData.fundingType === "treasury" && "Requires admin approval before poll can be funded"}
                    </small>
                  </div>

                  {formData.fundingType === "community" && (
                    <div className="form-group">
                      <label htmlFor="fundingGoal">Funding Goal (MASSA)</label>
                      <input
                        type="number"
                        id="fundingGoal"
                        value={formData.fundingGoal}
                        onChange={(e) => setFormData(prev => ({ ...prev, fundingGoal: parseFloat(e.target.value) || 0 }))}
                        min="0"
                        step="0.1"
                      />
                      <small>Target amount for community contributions</small>
                    </div>
                  )}
                </div>

                <div className="form-section">
                  <h2>Reward Distribution Settings</h2>

                  <div className="form-group">
                    <label htmlFor="rewardPool">Total Reward Pool (MASSA)</label>
                    <input
                      type="number"
                      id="rewardPool"
                      value={formData.rewardPool}
                      onChange={(e) => {
                        const pool = parseFloat(e.target.value) || 0;
                        setFormData(prev => ({
                          ...prev,
                          rewardPool: pool,
                          voteRewardAmount: pool // Keep voteRewardAmount in sync for backward compatibility
                        }));
                      }}
                      min="0"
                      step="0.1"
                    />
                    <small>
                      Total amount of MASSA to allocate for rewarding poll respondents (transferred from your wallet)
                    </small>
                  </div>

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
                      {formData.distributionMode === "equal" && "Total pool split equally among a fixed number of respondents"}
                      {formData.distributionMode === "fixed" && "Fixed amount per respondent until pool depletes"}
                      {formData.distributionMode === "weighted" && "Weighted by response quality (for surveys)"}
                    </small>
                  </div>

                  {formData.distributionMode === "fixed" && (
                    <>
                      <div className="form-group">
                        <label htmlFor="fixedRewardAmount">Fixed Reward per Respondent (MASSA)</label>
                        <input
                          type="number"
                          id="fixedRewardAmount"
                          value={formData.fixedRewardAmount}
                          onChange={(e) => setFormData(prev => ({ ...prev, fixedRewardAmount: parseFloat(e.target.value) || 0 }))}
                          min="0"
                          step="0.1"
                        />
                        <small>Amount each respondent receives (first-come, first-served until pool depletes)</small>
                      </div>
                      {formData.rewardPool > 0 && formData.fixedRewardAmount > 0 && (
                        <div className="info-banner">
                          <strong>📊 Calculated:</strong> With a total pool of <strong>{formData.rewardPool} MASSA</strong> and fixed reward of <strong>{formData.fixedRewardAmount} MASSA</strong>, approximately <strong>{Math.floor(formData.rewardPool / formData.fixedRewardAmount)}</strong> respondents can be rewarded.
                        </div>
                      )}
                    </>
                  )}

                  {formData.distributionMode === "equal" && (
                    <>
                      <div className="form-group">
                        <label htmlFor="maxRespondents">Maximum Number of Respondents</label>
                        <input
                          type="number"
                          id="maxRespondents"
                          value={formData.rewardPool > 0 && formData.fixedRewardAmount > 0 ? Math.floor(formData.rewardPool / formData.fixedRewardAmount) : 10}
                          onChange={(e) => {
                            const maxRespondents = parseInt(e.target.value) || 10;
                            // Calculate fixedRewardAmount based on pool and max respondents
                            const rewardPerRespondent = formData.rewardPool > 0 ? formData.rewardPool / maxRespondents : 0;
                            setFormData(prev => ({
                              ...prev,
                              fixedRewardAmount: rewardPerRespondent
                            }));
                          }}
                          min="1"
                          step="1"
                        />
                        <small>How many respondents will share the total reward pool equally</small>
                      </div>
                      {formData.rewardPool > 0 && formData.fixedRewardAmount > 0 && (
                        <div className="info-banner">
                          <strong>📊 Calculated:</strong> Each respondent will receive <strong>{formData.fixedRewardAmount.toFixed(4)} MASSA</strong> (total pool: {formData.rewardPool} MASSA ÷ {Math.floor(formData.rewardPool / formData.fixedRewardAmount)} respondents).
                        </div>
                      )}
                    </>
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
                      {formData.distributionType === "manual-pull" && "Respondents claim their rewards after poll ends"}
                      {formData.distributionType === "manual-push" && "You trigger reward distribution to all respondents"}
                      {formData.distributionType === "autonomous" && "Automatic distribution by smart contract when poll ends"}
                    </small>
                  </div>
                </div>
              </div>
            )}

            {/* Step Navigation */}
            <div className="form-actions step-navigation">
              {currentStep > 1 && (
                <button
                  type="button"
                  className="step-nav-btn prev-btn"
                  onClick={prevStep}
                >
                  Previous
                </button>
              )}
              {currentStep < totalSteps ? (
                <button
                  type="button"
                  className="step-nav-btn next-btn"
                  onClick={nextStep}
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  className="create-poll-submit"
                  disabled={isCreating || !isWalletConnected}
                >
                  {isCreating ? "Creating Poll..." : !isWalletConnected ? "Connect Wallet to Create Poll" : "Create Poll"}
                </button>
              )}
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
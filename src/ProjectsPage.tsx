import { useState, useEffect } from "react";
import CreateProject from "./CreateProject";
import { pollsContract } from "./utils/contractInteraction";
import { logError } from "./utils/errorHandling";
import FolderIcon from '@mui/icons-material/Folder';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PollIcon from '@mui/icons-material/Poll';
import PersonIcon from '@mui/icons-material/Person';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import TableChartIcon from '@mui/icons-material/TableChart';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ErrorIcon from '@mui/icons-material/Error';

interface Project {
  id: number;
  name: string;
  description: string;
  creator: string;
  createdAt: number;
  pollCount: number;
  status: 'active' | 'archived';
}

interface ProjectsPageProps {
  onBack: () => void;
}

const ProjectsPage = ({ onBack }: ProjectsPageProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setIsLoadingProjects(true);
    setProjectsError(null);

    try {
      console.log('🔄 Fetching projects from blockchain...');

      // Fetch projects from blockchain
      const contractProjects = await pollsContract.getAllProjects();

      console.log(`📊 Retrieved ${contractProjects.length} projects from contract`);

      // Transform ContractProject to Project format
      const displayProjects: Project[] = contractProjects.map(project => {
        const projectId = parseInt(project.id);
        const pollCount = project.pollIds?.length || 0;

        // Determine status based on poll count or creation date
        // Projects with no polls or very old could be considered archived
        const daysSinceCreation = (Date.now() - project.createdAt) / (1000 * 60 * 60 * 24);
        const status: 'active' | 'archived' = daysSinceCreation > 90 && pollCount === 0 ? 'archived' : 'active';

        return {
          id: projectId,
          name: project.name,
          description: project.description,
          creator: project.creator,
          createdAt: project.createdAt,
          pollCount: pollCount,
          status: status
        };
      });

      console.log(`✅ Successfully processed ${displayProjects.length} projects for display`);

      setProjects(displayProjects);
      setProjectsError(null);
    } catch (error) {
      console.error("❌ Error fetching projects:", error);
      logError(error, { action: 'fetching projects' });
      setProjectsError("Failed to load projects from blockchain. Please try again.");
      setProjects([]);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleCreateProject = () => {
    setShowCreateProject(true);
  };

  const handleProjectCreated = () => {
    setShowCreateProject(false);
    fetchProjects();
  };

  if (showCreateProject) {
    return (
      <CreateProject
        onBack={() => setShowCreateProject(false)}
        onProjectCreated={handleProjectCreated}
      />
    );
  }

  return (
    <div className="projects-page">
      <div className="projects-container">
        <div className="projects-header">
          <button className="back-btn" onClick={onBack}>
            ← Back
          </button>

          <div className="projects-header-content">
            <div className="header-left">
              <h1><FolderIcon sx={{ fontSize: 32, marginRight: 1, verticalAlign: 'middle' }} /> Projects</h1>
              <p>Organize your polls into projects for better management</p>
            </div>
            <button className="create-project-btn" onClick={handleCreateProject}>
              <AddIcon sx={{ fontSize: 20, marginRight: 0.5, verticalAlign: 'middle' }} /> Create Project
            </button>
          </div>
        </div>

        <div className="projects-content">
          {isLoadingProjects ? (
            <div className="loading-state">
              <h3><RefreshIcon sx={{ fontSize: 24, marginRight: 1, verticalAlign: 'middle' }} /> Loading Projects...</h3>
              <p>Fetching your projects from the blockchain.</p>
            </div>
          ) : projectsError ? (
            <div className="error-state">
              <h3><ErrorIcon sx={{ fontSize: 24, marginRight: 1, verticalAlign: 'middle' }} /> Error Loading Projects</h3>
              <p>{projectsError}</p>
              <button className="retry-btn" onClick={fetchProjects}>
                <RefreshIcon sx={{ fontSize: 18, marginRight: 0.5, verticalAlign: 'middle' }} /> Retry
              </button>
            </div>
          ) : projects.length === 0 ? (
            <div className="empty-state">
              <h3><FolderIcon sx={{ fontSize: 48 }} /></h3>
              <h3>No Projects Yet</h3>
              <p>Create your first project to organize your polls</p>
              <button className="create-first-project-btn" onClick={handleCreateProject}>
                <AddIcon sx={{ fontSize: 18, marginRight: 0.5, verticalAlign: 'middle' }} /> Create Your First Project
              </button>
            </div>
          ) : (
            <>
              <div className="projects-toolbar">
                <div className="toolbar-left">
                  <h3>All Projects ({projects.length})</h3>
                </div>
                <div className="toolbar-right">
                  <div className="view-mode-toggle">
                    <button
                      className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
                      onClick={() => setViewMode('table')}
                      title="Table View"
                    >
                      <TableChartIcon sx={{ fontSize: 18 }} />
                    </button>
                    <button
                      className={`view-mode-btn ${viewMode === 'cards' ? 'active' : ''}`}
                      onClick={() => setViewMode('cards')}
                      title="Card View"
                    >
                      <ViewModuleIcon sx={{ fontSize: 18 }} />
                    </button>
                  </div>
                  <button className="refresh-btn" onClick={fetchProjects}>
                    <RefreshIcon sx={{ fontSize: 18, marginRight: 0.5, verticalAlign: 'middle' }} /> Refresh
                  </button>
                </div>
              </div>

              {viewMode === 'table' ? (
                <div className="projects-table-container">
                  <table className="projects-table">
                    <thead>
                      <tr>
                        <th>PROJECT</th>
                        <th>STATUS</th>
                        <th>POLLS</th>
                        <th>CREATOR</th>
                        <th>CREATED</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map(project => (
                        <tr
                          key={project.id}
                          className={`project-row ${project.status === 'archived' ? 'archived' : ''}`}
                          onClick={() => setSelectedProject(project)}
                        >
                          <td className="td-project">
                            <div className="project-cell">
                              <div className="project-icon">
                                <FolderIcon sx={{ fontSize: 24 }} />
                              </div>
                              <div className="project-info">
                                <span className="project-name">{project.name}</span>
                                <span className="project-description">{project.description}</span>
                              </div>
                            </div>
                          </td>
                          <td className="td-status">
                            <span className={`status-badge ${project.status}`}>
                              {project.status}
                            </span>
                          </td>
                          <td className="td-polls">
                            <span className="polls-count">
                              <PollIcon sx={{ fontSize: 16, marginRight: 0.5, verticalAlign: 'middle' }} />
                              {project.pollCount}
                            </span>
                          </td>
                          <td className="td-creator">
                            <span className="creator-address">
                              {project.creator.slice(0, 6)}...{project.creator.slice(-4)}
                            </span>
                          </td>
                          <td className="td-created">
                            <span className="created-date">
                              {new Date(project.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="td-actions">
                            <button className="action-menu-btn" onClick={(e) => { e.stopPropagation(); }}>
                              <MoreVertIcon sx={{ fontSize: 20 }} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="projects-grid">
                  {projects.map(project => (
                    <div
                      key={project.id}
                      className={`project-card ${project.status === 'archived' ? 'archived' : ''}`}
                      onClick={() => setSelectedProject(project)}
                    >
                      <div className="project-card-header">
                        <div className="project-card-icon">
                          <FolderIcon sx={{ fontSize: 32 }} />
                        </div>
                        <div className="project-card-menu">
                          <MoreVertIcon sx={{ fontSize: 20 }} />
                        </div>
                      </div>

                      <div className="project-card-content">
                        <h3>{project.name}</h3>
                        <p>{project.description}</p>
                      </div>

                      <div className="project-card-stats">
                        <div className="stat-item">
                          <PollIcon sx={{ fontSize: 18, marginRight: 0.5, verticalAlign: 'middle' }} />
                          <span>{project.pollCount} polls</span>
                        </div>
                        <div className="stat-item">
                          <CalendarTodayIcon sx={{ fontSize: 16, marginRight: 0.5, verticalAlign: 'middle' }} />
                          <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="project-card-footer">
                        <span className={`status-badge ${project.status}`}>
                          {project.status}
                        </span>
                        <div className="creator-info">
                          <PersonIcon sx={{ fontSize: 16, marginRight: 0.5, verticalAlign: 'middle' }} />
                          <span>{project.creator.slice(0, 6)}...{project.creator.slice(-4)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectsPage;
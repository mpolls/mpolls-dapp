import { useState, useEffect } from "react";
import CreateProject from "./CreateProject";
import FolderIcon from '@mui/icons-material/Folder';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PollIcon from '@mui/icons-material/Poll';
import PersonIcon from '@mui/icons-material/Person';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import TableChartIcon from '@mui/icons-material/TableChart';
import ViewModuleIcon from '@mui/icons-material/ViewModule';

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
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setIsLoadingProjects(true);
    try {
      // TODO: Implement actual blockchain fetch
      // Simulating with dummy data for now
      setTimeout(() => {
        const dummyProjects: Project[] = [
          {
            id: 1,
            name: "Community Governance",
            description: "Polls and surveys for community decision making",
            creator: "AU1Pd3bod1Js2xD71GLFd1Q1dA8tnugsHroL54Rn7SzYY5KiozfS",
            createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
            pollCount: 12,
            status: 'active'
          },
          {
            id: 2,
            name: "Product Feedback",
            description: "Customer feedback and feature requests",
            creator: "AU1Pd3bod1Js2xD71GLFd1Q1dA8tnugsHroL54Rn7SzYY5KiozfS",
            createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
            pollCount: 8,
            status: 'active'
          },
          {
            id: 3,
            name: "Team Surveys",
            description: "Internal team feedback and pulse checks",
            creator: "AU1Pd3bod1Js2xD71GLFd1Q1dA8tnugsHroL54Rn7SzYY5KiozfS",
            createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
            pollCount: 5,
            status: 'archived'
          }
        ];
        setProjects(dummyProjects);
        setIsLoadingProjects(false);
      }, 1000);
    } catch (error) {
      console.error("Error fetching projects:", error);
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
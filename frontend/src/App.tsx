import React, { useEffect } from 'react';
import { Header } from './components/Header';
import { MediaLibrary } from './components/MediaLibrary';
import { PreviewPlayer } from './components/PreviewPlayer';
import { Timeline } from './components/Timeline';
import { useEditorStore } from './hooks/useEditorStore';
import { mediaAPI, projectsAPI } from './utils/api';
import './index.css';
import './i18n';

const App: React.FC = () => {
  const { setMediaLibrary, setCurrentProject, currentProject } = useEditorStore();
  
  useEffect(() => {
    const loadData = async () => {
      try {
        const media = await mediaAPI.list();
        setMediaLibrary(media);
        
        const projects = await projectsAPI.list();
        if (projects.length > 0 && !currentProject) {
          setCurrentProject(projects[0]);
        } else if (projects.length === 0) {
          const newProject = await projectsAPI.create('Nuevo Proyecto');
          setCurrentProject(newProject);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    
    loadData();
  }, [setMediaLibrary, setCurrentProject, currentProject]);
  
  return (
    <div className="app">
      <Header />
      
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: '250px', height: '100%' }}>
          <MediaLibrary />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ flex: 1, minHeight: '0' }}>
            <PreviewPlayer />
          </div>
          
          <div style={{ height: '300px' }}>
            <Timeline />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;

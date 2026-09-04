import { useState, useEffect, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import {
  apiCreateProjectComment,
  apiListProjectComments,
  apiResolveProjectComment
} from '../../utils/api';

export const useWorkspaceState = (stepId?: string, pathId: string = 'NEW_STUDY_DESIGN') => {
  const { 
    activeProject, 
    language, 
    isSecureMode, 
    updateProject, 
    updateProjectWorkflowProfile 
  } = useProject();

  const [activeStep, setActiveStep] = useState<string>(stepId || 'ideaExploration');
  const [mode, setMode] = useState<'guided' | 'expert'>('guided');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');

  // Input states for wizard steps
  const [descriptionAr, setDescriptionAr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [problemStatementAr, setProblemStatementAr] = useState('');
  const [problemStatementEn, setProblemStatementEn] = useState('');
  const [objectives, setObjectives] = useState('');
  const [timeline, setTimeline] = useState('');
  const [ethics, setEthics] = useState('');

  // Comments & Risks states
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentPriority, setCommentPriority] = useState('NORMAL');
  const [isSidebarOpen] = useState(true);

  const projectId = activeProject?.id;
  const currentPathId = activeProject?.activePathId;

  useEffect(() => {
    if (!activeProject) return;
    setDescriptionAr(activeProject.descriptionAr || '');
    setDescriptionEn(activeProject.descriptionEn || '');
    setProblemStatementAr(activeProject.problemStatementAr || '');
    setProblemStatementEn(activeProject.problemStatementEn || '');
    setObjectives(activeProject.objectives || '');
    setTimeline(activeProject.timeline || '');
    setEthics(activeProject.ethics || '');
  }, [activeProject]);

  useEffect(() => {
    if (!projectId || currentPathId === pathId) return;
    void updateProjectWorkflowProfile(projectId, {
      activePathId: pathId,
      completedSteps: activeProject?.completedSteps || []
    });
  }, [projectId, currentPathId, pathId, activeProject?.completedSteps, updateProjectWorkflowProfile]);

  const loadComments = useCallback(async () => {
    if (!projectId || !isSecureMode) return;
    try {
      const data = await apiListProjectComments(projectId, activeStep);
      if (data) {
        setComments(data);
      }
    } catch (e) {
      console.warn("Failed to load step comments from backend", e);
    }
  }, [projectId, activeStep, isSecureMode]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !activeProject) return;
    try {
      const comment = await apiCreateProjectComment({
        projectId: activeProject.id,
        step: activeStep,
        contentAr: newCommentText,
        priority: commentPriority
      });
      if (comment) {
        setNewCommentText('');
        loadComments();
      }
    } catch (e) {
      console.error("Failed to post comment", e);
    }
  };

  const handleResolveComment = async (commentId: string) => {
    try {
      const comment = await apiResolveProjectComment(commentId, true);
      if (comment) {
        loadComments();
      }
    } catch (e) {
      console.error("Failed to resolve comment", e);
    }
  };

  const handleSaveTextChanges = () => {
    if (!activeProject) return;
    setSaveStatus('saving');
    const updated = {
      ...activeProject,
      descriptionAr,
      descriptionEn,
      problemStatementAr,
      problemStatementEn,
      objectives,
      timeline,
      ethics
    };
    updateProject(updated);
    setSaveStatus('saved');
  };

  // Complete step rule checker
  const handleMarkStepCompleted = () => {
    if (!activeProject) return;
    const completed = activeProject.completedSteps || [];
    if (!completed.includes(activeStep)) {
      const updatedList = [...completed, activeStep];
      updateProjectWorkflowProfile(activeProject.id, {
        completedSteps: updatedList
      });
    }
  };

  const handleMarkStepIncomplete = () => {
    if (!activeProject) return;
    const completed = activeProject.completedSteps || [];
    if (completed.includes(activeStep)) {
      const updatedList = completed.filter(s => s !== activeStep);
      updateProjectWorkflowProfile(activeProject.id, {
        completedSteps: updatedList
      });
    }
  };

  const handleStepNavigation = (stepId: string) => {
    setActiveStep(stepId);
  };

  return {
    activeStep,
    setActiveStep,
    mode,
    setMode,
    saveStatus,
    setSaveStatus,
    descriptionAr,
    setDescriptionAr,
    descriptionEn,
    setDescriptionEn,
    problemStatementAr,
    setProblemStatementAr,
    problemStatementEn,
    setProblemStatementEn,
    objectives,
    setObjectives,
    timeline,
    setTimeline,
    ethics,
    setEthics,
    comments,
    newCommentText,
    setNewCommentText,
    commentPriority,
    setCommentPriority,
    isSidebarOpen,
    activeProject,
    language,
    isSecureMode,
    handlePostComment,
    handleResolveComment,
    handleSaveTextChanges,
    handleMarkStepCompleted,
    handleMarkStepIncomplete,
    handleStepNavigation,
    loadComments,
    updateProject
  };
};

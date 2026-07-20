import React from 'react';

interface IllustrationProps {
  className?: string;
  size?: number;
}

export const StudyDesignIllustration: React.FC<IllustrationProps> = ({ className = '', size = 120 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
    <rect x="25" y="25" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="2" fill="var(--ds-surface-secondary)" />
    <rect x="55" y="25" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="2" fill="var(--ds-surface-secondary)" />
    <rect x="40" y="55" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="2" fill="var(--ds-surface-secondary)" />
    <path d="M35 45V65H40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M65 45V65H60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const SeminarReviewIllustration: React.FC<IllustrationProps> = ({ className = '', size = 120 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M20 20H80V80H20V20Z" stroke="currentColor" strokeWidth="2" />
    <path d="M30 35H70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M30 45H60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M30 55H50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="65" cy="60" r="10" stroke="currentColor" strokeWidth="2" fill="var(--ds-surface-secondary)" />
    <path d="M72 67L80 75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const SimulationIllustration: React.FC<IllustrationProps> = ({ className = '', size = 120 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M10 80H90" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M15 75C25 40, 35 60, 50 30C65 5, 75 45, 85 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="50" cy="30" r="4" fill="var(--ds-primary)" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="85" cy="15" r="4" fill="var(--ds-primary)" stroke="currentColor" strokeWidth="1.5" />
    <line x1="50" y1="30" x2="50" y2="80" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
    <line x1="85" y1="15" x2="85" y2="80" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
  </svg>
);

export const PredictionIllustration: React.FC<IllustrationProps> = ({ className = '', size = 120 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M20 70H80" stroke="currentColor" strokeWidth="2" />
    <path d="M30 70V50" stroke="currentColor" strokeWidth="2" />
    <path d="M50 70V30" stroke="currentColor" strokeWidth="2" />
    <path d="M70 70V10" stroke="currentColor" strokeWidth="2" />
    <path d="M30 45L50 25L70 5" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
    <circle cx="70" cy="5" r="5" fill="var(--ds-success)" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const FieldStudyIllustration: React.FC<IllustrationProps> = ({ className = '', size = 120 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="20" y="20" width="60" height="60" rx="6" stroke="currentColor" strokeWidth="2" />
    <circle cx="35" cy="35" r="5" fill="currentColor" />
    <circle cx="65" cy="35" r="5" fill="currentColor" />
    <path d="M30 55H70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M30 65H50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const DataAnalysisIllustration: React.FC<IllustrationProps> = ({ className = '', size = 120 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M20 80V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M20 80H80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <rect x="30" y="50" width="10" height="30" fill="currentColor" opacity="0.3" />
    <rect x="45" y="35" width="10" height="45" fill="currentColor" opacity="0.6" />
    <rect x="60" y="20" width="10" height="60" fill="currentColor" />
  </svg>
);

export const ThesisDefenceIllustration: React.FC<IllustrationProps> = ({ className = '', size = 120 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M25 50L50 25L75 50L50 75L25 50Z" stroke="currentColor" strokeWidth="2" />
    <circle cx="50" cy="50" r="10" stroke="currentColor" strokeWidth="2" fill="var(--ds-surface-secondary)" />
    <path d="M50 15V25" stroke="currentColor" strokeWidth="1.5" />
    <path d="M50 75V85" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const ReadingPaperIllustration: React.FC<IllustrationProps> = ({ className = '', size = 120 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="25" y="15" width="50" height="70" rx="4" stroke="currentColor" strokeWidth="2" />
    <line x1="35" y1="30" x2="65" y2="30" stroke="currentColor" strokeWidth="2" />
    <line x1="35" y1="40" x2="65" y2="40" stroke="currentColor" strokeWidth="2" />
    <line x1="35" y1="50" x2="55" y2="50" stroke="currentColor" strokeWidth="2" />
    <line x1="35" y1="60" x2="60" y2="60" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
  </svg>
);

export const ScientificPublishingIllustration: React.FC<IllustrationProps> = ({ className = '', size = 120 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M30 40H70" stroke="currentColor" strokeWidth="2" />
    <path d="M30 50H70" stroke="currentColor" strokeWidth="2" />
    <path d="M30 60H55" stroke="currentColor" strokeWidth="2" />
    <rect x="20" y="20" width="60" height="60" rx="6" stroke="currentColor" strokeWidth="2" />
    <path d="M65 15L75 25" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const SystematicReviewIllustration: React.FC<IllustrationProps> = ({ className = '', size = 120 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M15 15H85V35H15V15Z" stroke="currentColor" strokeWidth="2" />
    <path d="M25 45H75V65H25V45Z" stroke="currentColor" strokeWidth="2" />
    <path d="M35 75H65V90H35V75Z" stroke="currentColor" strokeWidth="2" />
    <path d="M50 35V45" stroke="currentColor" strokeWidth="1.5" />
    <path d="M50 65V75" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const QualitativeResearchIllustration: React.FC<IllustrationProps> = ({ className = '', size = 120 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="2" />
    <path d="M35 45C35 45, 45 40, 50 50C55 60, 65 55, 65 55" stroke="currentColor" strokeWidth="2" />
    <circle cx="35" cy="45" r="3" fill="currentColor" />
    <circle cx="65" cy="55" r="3" fill="currentColor" />
    <circle cx="50" cy="50" r="3" fill="currentColor" />
  </svg>
);

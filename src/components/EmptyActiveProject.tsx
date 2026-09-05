import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../design-system/components/Button';
import { EmptyState } from '../design-system/components/Feedback';
import { ROUTES } from '../router/routes';

type EmptyActiveProjectProps = {
  language: string;
  description: string;
  title?: string;
  illustration?: React.ReactNode;
};

export const EmptyActiveProject: React.FC<EmptyActiveProjectProps> = ({
  language,
  description,
  title,
  illustration,
}) => {
  const navigate = useNavigate();
  const ar = language === 'ar';
  return (
    <EmptyState
      illustration={illustration}
      title={title ?? (ar ? 'ابدأ بمشروع بحثي' : 'Start a research project')}
      description={description}
      actionButton={
        <Button type="button" variant="primary" size="sm" onClick={() => navigate(ROUTES.PATHS)}>
          {ar ? 'اختيار مسار البحث' : 'Choose a research path'}
        </Button>
      }
    />
  );
};

import type { SupportLensKey } from './types';

export interface SupportLensDefinition {
  key: SupportLensKey;
  title: string;
  subtitle: string;
  pressureEmphasis: 'project_health' | 'coordination';
  linkedWorkMode: 'project_portfolio' | 'relationship_coordination';
  supportsMaintenance: boolean;
}

export const supportLensRegistry: Record<SupportLensKey, SupportLensDefinition> = {
  projects: {
    key: 'projects',
    title: 'Project support workspace',
    subtitle: 'Project pressure lens for portfolio health and route-to-lane execution.',
    pressureEmphasis: 'project_health',
    linkedWorkMode: 'project_portfolio',
    supportsMaintenance: true,
  },
  relationships: {
    key: 'relationships',
    title: 'Relationship support workspace',
    subtitle: 'Coordination pressure lens for contact/company follow-through.',
    pressureEmphasis: 'coordination',
    linkedWorkMode: 'relationship_coordination',
    supportsMaintenance: true,
  },
};

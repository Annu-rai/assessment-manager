/**
 * Role-Based Access Control (Module 2).
 *
 * Roles are ordered from most to least privileged. `super_admin` is the platform
 * owner (can see across organizations); everyone else is scoped to their own org.
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ORG_ADMIN: 'org_admin',
  RECRUITER: 'recruiter',
  INTERVIEWER: 'interviewer',
  TRAINER: 'trainer',
  CANDIDATE: 'candidate',
};

export const ROLE_VALUES = Object.values(ROLES);

// Roles that can create/edit assessments and manage candidates.
export const STAFF_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ORG_ADMIN,
  ROLES.RECRUITER,
  ROLES.INTERVIEWER,
  ROLES.TRAINER,
];

// Roles allowed to manage users within an organization.
export const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN];

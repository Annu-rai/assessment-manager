// Mirrors server/src/config/roles.js. Keep in sync.
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ORG_ADMIN: 'org_admin',
  RECRUITER: 'recruiter',
  INTERVIEWER: 'interviewer',
  TRAINER: 'trainer',
  CANDIDATE: 'candidate',
};

export const STAFF_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ORG_ADMIN,
  ROLES.RECRUITER,
  ROLES.INTERVIEWER,
  ROLES.TRAINER,
];

export const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN];

export const isStaff = (user) => !!user && STAFF_ROLES.includes(user.role);
export const isAdmin = (user) => !!user && ADMIN_ROLES.includes(user.role);
export const isCandidate = (user) => user?.role === ROLES.CANDIDATE;

// Human-friendly labels for badges/selects.
export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  org_admin: 'Org Admin',
  recruiter: 'Recruiter',
  interviewer: 'Interviewer',
  trainer: 'Trainer',
  candidate: 'Candidate',
};

// The default landing route for a given user, by role.
export const homeFor = (user) => (isCandidate(user) ? '/candidate' : '/dashboard');

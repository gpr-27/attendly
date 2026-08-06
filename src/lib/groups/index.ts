/**
 * Barrel for isomorphic (server + client safe) group exports only.
 * Import `@/lib/groups/server` from API routes and `@/lib/groups/client`
 * from client components — keep the service-role code out of client bundles.
 */
export type {
  CreateGroupInput,
  Group,
  GroupDetail,
  GroupListResult,
  GroupMember,
  GroupMemberListResult,
  GroupMessage,
  GroupRole,
} from "./types";
export {
  buildGroupSlug,
  canDeleteGroupMessage,
  clampPage,
  clampPageSize,
  escapeIlikePattern,
  normalizeSearchQuery,
  slugifyGroupName,
  validateGroupDescription,
  validateGroupName,
  validateInstitution,
  validateMessageBody,
  DEFAULT_MESSAGE_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  GROUP_DESCRIPTION_MAX,
  GROUP_INSTITUTION_MAX,
  GROUP_NAME_MAX,
  GROUP_NAME_MIN,
  MAX_MESSAGE_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MESSAGE_BODY_MAX,
  SEARCH_QUERY_MAX,
} from "./validation";

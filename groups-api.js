// API client for group calendars management
// Handles group CRUD, invitations, and member management

import { state } from './state.js';
import { API_BASE_URL, apiFetch } from './api.js';

/**
 * Get all groups where user is a member
 * @returns {Promise<Array>}
 */
export async function fetchUserGroups() {
  const res = await apiFetch('/api/groups');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return data.data || [];
}

/**
 * Get group details including members
 * @param {string} groupId 
 * @returns {Promise<Object>}
 */
export async function fetchGroupDetails(groupId) {
  const res = await apiFetch(`/api/groups/${groupId}`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return data.data;
}

/**
 * Create a new group
 * @param {Object} groupData
 * @param {string} groupData.name
 * @param {string} [groupData.description]
 * @returns {Promise<Object>}
 */
export async function createGroup({ name, description }) {
  const res = await apiFetch('/api/groups', {
    method: 'POST',
    body: JSON.stringify({ name, description })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error('HTTP ' + res.status + ': ' + errorText);
  }
  const data = await res.json();
  return data.data;
}

/**
 * Update group information
 * @param {string} groupId 
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateGroup(groupId, updates) {
  const res = await apiFetch(`/api/groups/${groupId}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return data.data;
}

/**
 * Delete a group (only creator)
 * @param {string} groupId 
 * @returns {Promise<boolean>}
 */
export async function deleteGroup(groupId) {
  const res = await apiFetch(`/api/groups/${groupId}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return true;
}

/**
 * Invite a user to group by GitHub username
 * @param {string} groupId 
 * @param {string} githubUsername 
 * @returns {Promise<Object>}
 */
export async function inviteToGroup(groupId, githubUsername) {
  const res = await apiFetch(`/api/groups/${groupId}/invite`, {
    method: 'POST',
    body: JSON.stringify({ github_username: githubUsername })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error('HTTP ' + res.status + ': ' + errorText);
  }
  const data = await res.json();
  return data;
}

/**
 * Get pending invitations for current user
 * @returns {Promise<Array>}
 */
export async function fetchPendingInvitations() {
  const res = await apiFetch('/api/groups/invitations/pending');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return data.data || [];
}

/**
 * Accept a group invitation
 * @param {string} invitationId 
 * @returns {Promise<boolean>}
 */
export async function acceptInvitation(invitationId) {
  const res = await apiFetch(`/api/groups/invitations/${invitationId}/accept`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return true;
}

/**
 * Reject a group invitation
 * @param {string} invitationId 
 * @returns {Promise<boolean>}
 */
export async function rejectInvitation(invitationId) {
  const res = await apiFetch(`/api/groups/invitations/${invitationId}/reject`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return true;
}

/**
 * Remove a member from group (admin only)
 * @param {string} groupId 
 * @param {string} memberId 
 * @returns {Promise<boolean>}
 */
export async function removeMember(groupId, memberId) {
  const res = await apiFetch(`/api/groups/${groupId}/members/${memberId}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return true;
}

/**
 * Leave a group
 * @param {string} groupId 
 * @returns {Promise<boolean>}
 */
export async function leaveGroup(groupId) {
  const res = await apiFetch(`/api/groups/${groupId}/leave`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return true;
}

/**
 * Fetch tasks for a specific group
 * @param {string} groupId - 'personal' for personal tasks, or group UUID
 * @returns {Promise<Array>}
 */
export async function fetchGroupTasks(groupId) {
  const res = await apiFetch(`/api/tasks?group_id=${groupId}`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return data.data || [];
}

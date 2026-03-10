const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { supabaseAdmin: supabase } = require('../utils/supabase.js');
const { asyncHandler, AppError } = require('../middleware/errorHandler.js');
const logger = require('../utils/logger.js');
const { authenticate } = require('../middleware/auth.js');

const router = express.Router();
router.use(authenticate);

// ── Validation helpers ────────────────────────────────────────────────────────

const validateGroup = [
    body('name').trim().isLength({ min: 1, max: 255 }).withMessage('Group name required (max 255 chars)'),
    body('description').optional().isLength({ max: 1000 })
];

function handleErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    next();
}

// Helper: verify user is member of group (or owner)
async function assertMember(userId, groupId) {
    const { data, error } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', String(userId))
        .single();
    if (error || !data) throw new AppError('Not a member of this group', 403);
    return data.role;
}

// Helper: verify user is owner or admin
async function assertAdmin(userId, groupId) {
    const role = await assertMember(userId, groupId);
    if (!['owner', 'admin'].includes(role)) throw new AppError('Admin rights required', 403);
    return role;
}

// ── CRUD Groups ───────────────────────────────────────────────────────────────

/**
 * GET /api/groups
 * List all groups the current user belongs to
 */
router.get('/', asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('group_members')
        .select(`
      role,
      joined_at,
      groups (
        id, name, description, owner_id, invite_code, created_at,
        group_members ( count )
      )
    `)
        .eq('user_id', String(req.user.id))
        .order('joined_at', { ascending: false });

    if (error) {
        logger.error('Error fetching groups:', error);
        throw new AppError('Error fetching groups', 500);
    }

    const groups = (data || []).map(m => ({
        ...m.groups,
        my_role: m.role,
        joined_at: m.joined_at,
        member_count: m.groups?.group_members?.[0]?.count ?? 0
    }));

    res.json({ success: true, data: groups });
}));

/**
 * POST /api/groups
 * Create a new group (creator becomes owner automatically via DB trigger)
 */
router.post('/', validateGroup, handleErrors, asyncHandler(async (req, res) => {
    const { name, description } = req.body;

    const { data, error } = await supabase
        .from('groups')
        .insert([{ name: name.trim(), description: description?.trim() || null, owner_id: String(req.user.id) }])
        .select()
        .single();

    if (error) {
        logger.error('Error creating group:', error);
        throw new AppError('Error creating group', 500);
    }

    logger.info(`Group created: ${data.id} by user ${req.user.id}`);
    res.status(201).json({ success: true, data });
}));

/**
 * GET /api/groups/:id
 * Get group details including members list
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const groupId = parseInt(req.params.id);
    await assertMember(req.user.id, groupId);

    const { data, error } = await supabase
        .from('groups')
        .select(`
      *,
      group_members (
        role, joined_at,
        users ( id, username, name, avatar_url )
      )
    `)
        .eq('id', groupId)
        .single();

    if (error || !data) throw new AppError('Group not found', 404);

    res.json({ success: true, data });
}));

/**
 * PATCH /api/groups/:id
 * Update group name/description (admin/owner only)
 */
router.patch('/:id', validateGroup, handleErrors, asyncHandler(async (req, res) => {
    const groupId = parseInt(req.params.id);
    await assertAdmin(req.user.id, groupId);

    const updates = {};
    if (req.body.name) updates.name = req.body.name.trim();
    if (req.body.description !== undefined) updates.description = req.body.description?.trim() || null;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('groups')
        .update(updates)
        .eq('id', groupId)
        .select()
        .single();

    if (error || !data) throw new AppError('Group not found or update failed', 404);

    res.json({ success: true, data });
}));

/**
 * DELETE /api/groups/:id
 * Delete group (owner only). Cascades to group_members.
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const groupId = parseInt(req.params.id);
    const { data: group } = await supabase.from('groups').select('owner_id').eq('id', groupId).single();
    if (!group || group.owner_id !== String(req.user.id)) throw new AppError('Only the group owner can delete it', 403);

    const { error } = await supabase.from('groups').delete().eq('id', groupId);
    if (error) throw new AppError('Error deleting group', 500);

    logger.info(`Group deleted: ${groupId} by user ${req.user.id}`);
    res.json({ success: true, message: 'Group deleted' });
}));

// ── Membership Management ─────────────────────────────────────────────────────

/**
 * POST /api/groups/join
 * Join a group via invite code
 * Body: { invite_code: "ABCD1234" }
 */
router.post('/join', asyncHandler(async (req, res) => {
    const { invite_code } = req.body;
    if (!invite_code) throw new AppError('Invite code required', 400);

    const { data: group, error: gErr } = await supabase
        .from('groups')
        .select('id, name')
        .eq('invite_code', invite_code.toUpperCase())
        .single();

    if (gErr || !group) throw new AppError('Invalid or expired invite code', 404);

    // Check not already a member
    const { data: existing } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', group.id)
        .eq('user_id', String(req.user.id))
        .single();

    if (existing) return res.json({ success: true, data: group, already_member: true });

    const { error: joinErr } = await supabase
        .from('group_members')
        .insert([{ group_id: group.id, user_id: String(req.user.id), role: 'member' }]);

    if (joinErr) throw new AppError('Error joining group', 500);

    logger.info(`User ${req.user.id} joined group ${group.id}`);
    res.status(201).json({ success: true, data: group });
}));

/**
 * DELETE /api/groups/:id/members/:userId
 * Remove a member (admin/owner, or self-leave)
 */
router.delete('/:id/members/:userId', asyncHandler(async (req, res) => {
    const groupId = parseInt(req.params.id);
    const targetId = String(req.params.userId);
    const isSelf = targetId === String(req.user.id);

    if (!isSelf) {
        await assertAdmin(req.user.id, groupId);
    }

    // Cannot remove the owner
    const { data: group } = await supabase.from('groups').select('owner_id').eq('id', groupId).single();
    if (group?.owner_id === targetId) throw new AppError('Cannot remove the group owner', 403);

    const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', targetId);

    if (error) throw new AppError('Error removing member', 500);
    res.json({ success: true, message: isSelf ? 'Left group' : 'Member removed' });
}));

/**
 * PATCH /api/groups/:id/members/:userId/role
 * Change member role (owner only)
 * Body: { role: 'admin' | 'member' }
 */
router.patch('/:id/members/:userId/role', asyncHandler(async (req, res) => {
    const groupId = parseInt(req.params.id);
    const targetId = String(req.params.userId);
    const { role } = req.body;

    if (!['admin', 'member'].includes(role)) throw new AppError('Role must be admin or member', 400);

    const { data: group } = await supabase.from('groups').select('owner_id').eq('id', groupId).single();
    if (!group || group.owner_id !== String(req.user.id)) throw new AppError('Only owner can change roles', 403);
    if (targetId === String(req.user.id)) throw new AppError('Cannot change your own role', 400);

    const { data, error } = await supabase
        .from('group_members')
        .update({ role })
        .eq('group_id', groupId)
        .eq('user_id', targetId)
        .select()
        .single();

    if (error || !data) throw new AppError('Member not found', 404);
    res.json({ success: true, data });
}));

// ── Group Tasks ───────────────────────────────────────────────────────────────

/**
 * GET /api/groups/:id/tasks
 * Get all tasks assigned to a group (all members can read)
 */
router.get('/:id/tasks', asyncHandler(async (req, res) => {
    const groupId = parseInt(req.params.id);
    await assertMember(req.user.id, groupId);

    const { data, error } = await supabase
        .from('tasks')
        .select(`
      *,
      assigned_user:users!assigned_to ( id, username, name, avatar_url )
    `)
        .eq('group_id', groupId)
        .order('date', { ascending: true });

    if (error) throw new AppError('Error fetching group tasks', 500);
    res.json({ success: true, data: data || [] });
}));

/**
 * PATCH /api/groups/:id/tasks/:taskId/status
 * Update task_status (any member)
 * Body: { task_status: 'todo' | 'in_progress' | 'done' | 'blocked' }
 */
router.patch('/:id/tasks/:taskId/status', asyncHandler(async (req, res) => {
    const groupId = parseInt(req.params.id);
    const taskId = parseInt(req.params.taskId);
    const { task_status } = req.body;

    const VALID_STATUSES = ['todo', 'in_progress', 'done', 'blocked'];
    if (!VALID_STATUSES.includes(task_status)) throw new AppError(`status must be one of: ${VALID_STATUSES.join(', ')}`, 400);

    await assertMember(req.user.id, groupId);

    const { data, error } = await supabase
        .from('tasks')
        .update({ task_status })
        .eq('id', taskId)
        .eq('group_id', groupId)
        .select()
        .single();

    if (error || !data) throw new AppError('Task not found in this group', 404);
    res.json({ success: true, data });
}));

module.exports = router;

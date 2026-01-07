const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../utils/supabase.js');
const { emailService } = require('../utils/emailService.js');
const { asyncHandler, AppError } = require('../middleware/errorHandler.js');
const logger = require('../utils/logger.js');

const router = express.Router();

// Middleware de autenticación (reutilizar del tasks-supabase)
const authenticate = (req, res, next) => {
  // TODO: Implementar autenticación real con JWT
  // Por ahora usar el mismo usuario de prueba
  req.user = {
    id: '00000000-0000-0000-0000-000000000001',
    username: 'usuario_prueba'
  };
  next();
};

router.use(authenticate);

// Validaciones
const createGroupValidation = [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Group name required (max 100 chars)'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description too long (max 500 chars)')
];

const inviteValidation = [
  body('github_username').trim().notEmpty().withMessage('GitHub username required')
];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
}

// ============================================
// GRUPOS
// ============================================

/**
 * GET /api/groups
 * Obtener todos los grupos del usuario (donde es miembro)
 */
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const { data, error } = await supabase
    .from('group_members')
    .select(`
      group_id,
      role,
      joined_at,
      groups (
        id,
        name,
        description,
        created_by,
        created_at,
        users!groups_created_by_fkey (
          username,
          name,
          avatar_url
        )
      )
    `)
    .eq('user_id', userId);

  if (error) {
    logger.error('Error fetching user groups:', error);
    throw new AppError('Failed to fetch groups', 500);
  }

  // Transformar la respuesta para que sea más limpia
  const groups = (data || []).map(item => ({
    id: item.groups.id,
    name: item.groups.name,
    description: item.groups.description,
    created_by: item.groups.created_by,
    created_at: item.groups.created_at,
    creator: item.groups.users,
    user_role: item.role,
    joined_at: item.joined_at
  }));

  res.json({
    success: true,
    data: groups
  });
}));

/**
 * GET /api/groups/:id
 * Obtener detalles de un grupo específico
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Verificar que el usuario es miembro del grupo
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', id)
    .eq('user_id', userId)
    .single();

  if (!membership) {
    throw new AppError('Group not found or access denied', 404);
  }

  // Obtener información del grupo
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select(`
      *,
      users!groups_created_by_fkey (
        username,
        name,
        avatar_url
      )
    `)
    .eq('id', id)
    .single();

  if (groupError || !group) {
    throw new AppError('Group not found', 404);
  }

  // Obtener miembros del grupo
  const { data: members } = await supabase
    .from('group_members')
    .select(`
      id,
      role,
      joined_at,
      users (
        id,
        username,
        name,
        avatar_url,
        github_id
      )
    `)
    .eq('group_id', id);

  res.json({
    success: true,
    data: {
      ...group,
      creator: group.users,
      members: members || [],
      user_role: membership.role
    }
  });
}));

/**
 * POST /api/groups
 * Crear un nuevo grupo
 */
router.post('/', createGroupValidation, handleValidationErrors, asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const userId = req.user.id;

  // Crear el grupo
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert([{
      name,
      description: description || null,
      created_by: userId
    }])
    .select()
    .single();

  if (groupError) {
    logger.error('Error creating group:', groupError);
    throw new AppError('Failed to create group', 500);
  }

  // Agregar al creador como admin del grupo
  const { error: memberError } = await supabase
    .from('group_members')
    .insert([{
      group_id: group.id,
      user_id: userId,
      role: 'admin'
    }]);

  if (memberError) {
    logger.error('Error adding creator as member:', memberError);
    // Intentar eliminar el grupo si falla agregar el miembro
    await supabase.from('groups').delete().eq('id', group.id);
    throw new AppError('Failed to create group', 500);
  }

  logger.info(`Group created: ${group.id} by user ${userId}`);

  res.status(201).json({
    success: true,
    data: group
  });
}));

/**
 * PUT /api/groups/:id
 * Actualizar información del grupo (solo admins)
 */
router.put('/:id', createGroupValidation, handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const userId = req.user.id;

  // Verificar que el usuario es admin del grupo
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', id)
    .eq('user_id', userId)
    .single();

  if (!membership || membership.role !== 'admin') {
    throw new AppError('Only group admins can update group info', 403);
  }

  // Actualizar el grupo
  const { data, error } = await supabase
    .from('groups')
    .update({
      name,
      description: description || null
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Error updating group:', error);
    throw new AppError('Failed to update group', 500);
  }

  logger.info(`Group updated: ${id} by user ${userId}`);

  res.json({
    success: true,
    data
  });
}));

/**
 * DELETE /api/groups/:id
 * Eliminar un grupo (solo creador)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Verificar que el usuario es el creador del grupo
  const { data: group } = await supabase
    .from('groups')
    .select('created_by')
    .eq('id', id)
    .single();

  if (!group) {
    throw new AppError('Group not found', 404);
  }

  if (group.created_by !== userId) {
    throw new AppError('Only group creator can delete the group', 403);
  }

  // Eliminar el grupo (cascada eliminará miembros, invitaciones y tareas)
  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', id);

  if (error) {
    logger.error('Error deleting group:', error);
    throw new AppError('Failed to delete group', 500);
  }

  logger.info(`Group deleted: ${id} by user ${userId}`);

  res.json({
    success: true,
    message: 'Group deleted successfully'
  });
}));

// ============================================
// INVITACIONES
// ============================================

/**
 * POST /api/groups/:id/invite
 * Invitar usuario al grupo por GitHub username
 */
router.post('/:id/invite', inviteValidation, handleValidationErrors, asyncHandler(async (req, res) => {
  const { id: groupId } = req.params;
  const { github_username } = req.body;
  const userId = req.user.id;

  // Verificar que el usuario es admin del grupo
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (!membership || membership.role !== 'admin') {
    throw new AppError('Only group admins can invite members', 403);
  }

  // Verificar si ya existe una invitación pendiente
  const { data: existing } = await supabase
    .from('group_invitations')
    .select('id, status')
    .eq('group_id', groupId)
    .eq('invited_github_username', github_username.toLowerCase())
    .single();

  if (existing && existing.status === 'pending') {
    throw new AppError('Invitation already sent to this user', 400);
  }

  // Buscar si el usuario ya está registrado
  const { data: invitedUser } = await supabase
    .from('users')
    .select('id, email, username')
    .eq('username', github_username.toLowerCase())
    .single();

  // Si el usuario existe, verificar que no sea ya miembro
  if (invitedUser) {
    const { data: existingMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', invitedUser.id)
      .single();

    if (existingMember) {
      throw new AppError('User is already a member of this group', 400);
    }
  }

  // Crear la invitación
  const { data: invitation, error } = await supabase
    .from('group_invitations')
    .insert([{
      group_id: groupId,
      invited_by: userId,
      invited_github_username: github_username.toLowerCase(),
      invited_user_id: invitedUser?.id || null,
      status: 'pending'
    }])
    .select()
    .single();

  if (error) {
    logger.error('Error creating invitation:', error);
    throw new AppError('Failed to create invitation', 500);
  }

  // Si el usuario existe y tiene email, enviar notificación
  if (invitedUser && invitedUser.email && emailService.isAvailable()) {
    try {
      // Obtener info del grupo
      const { data: group } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .single();

      // TODO: Enviar email de invitación
      logger.info(`Invitation email should be sent to ${invitedUser.email}`);
    } catch (emailError) {
      logger.error('Failed to send invitation email:', emailError);
      // No fallar si el email falla
    }
  }

  logger.info(`Invitation created for ${github_username} to group ${groupId}`);

  res.status(201).json({
    success: true,
    data: invitation,
    message: invitedUser 
      ? 'Invitation sent successfully'
      : 'Invitation created. User will see it when they sign up.'
  });
}));

/**
 * GET /api/groups/invitations/pending
 * Obtener invitaciones pendientes del usuario
 */
router.get('/invitations/pending', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const { data, error } = await supabase
    .from('group_invitations')
    .select(`
      id,
      invited_at,
      groups (
        id,
        name,
        description,
        users!groups_created_by_fkey (
          username,
          name,
          avatar_url
        )
      ),
      inviter:users!group_invitations_invited_by_fkey (
        username,
        name,
        avatar_url
      )
    `)
    .eq('invited_user_id', userId)
    .eq('status', 'pending');

  if (error) {
    logger.error('Error fetching invitations:', error);
    throw new AppError('Failed to fetch invitations', 500);
  }

  res.json({
    success: true,
    data: data || []
  });
}));

/**
 * POST /api/groups/invitations/:id/accept
 * Aceptar invitación a grupo
 */
router.post('/invitations/:id/accept', asyncHandler(async (req, res) => {
  const { id: invitationId } = req.params;
  const userId = req.user.id;

  // Obtener la invitación
  const { data: invitation } = await supabase
    .from('group_invitations')
    .select('*')
    .eq('id', invitationId)
    .eq('invited_user_id', userId)
    .eq('status', 'pending')
    .single();

  if (!invitation) {
    throw new AppError('Invitation not found or already processed', 404);
  }

  // Agregar usuario al grupo
  const { error: memberError } = await supabase
    .from('group_members')
    .insert([{
      group_id: invitation.group_id,
      user_id: userId,
      role: 'member'
    }]);

  if (memberError) {
    logger.error('Error adding member to group:', memberError);
    throw new AppError('Failed to join group', 500);
  }

  // Actualizar estado de la invitación
  const { error: updateError } = await supabase
    .from('group_invitations')
    .update({
      status: 'accepted',
      responded_at: new Date().toISOString()
    })
    .eq('id', invitationId);

  if (updateError) {
    logger.error('Error updating invitation status:', updateError);
  }

  logger.info(`User ${userId} accepted invitation ${invitationId}`);

  res.json({
    success: true,
    message: 'Successfully joined the group'
  });
}));

/**
 * POST /api/groups/invitations/:id/reject
 * Rechazar invitación a grupo
 */
router.post('/invitations/:id/reject', asyncHandler(async (req, res) => {
  const { id: invitationId } = req.params;
  const userId = req.user.id;

  const { error } = await supabase
    .from('group_invitations')
    .update({
      status: 'rejected',
      responded_at: new Date().toISOString()
    })
    .eq('id', invitationId)
    .eq('invited_user_id', userId)
    .eq('status', 'pending');

  if (error) {
    logger.error('Error rejecting invitation:', error);
    throw new AppError('Failed to reject invitation', 500);
  }

  logger.info(`User ${userId} rejected invitation ${invitationId}`);

  res.json({
    success: true,
    message: 'Invitation rejected'
  });
}));

/**
 * DELETE /api/groups/:groupId/members/:userId
 * Remover miembro del grupo (solo admins)
 */
router.delete('/:groupId/members/:memberId', asyncHandler(async (req, res) => {
  const { groupId, memberId } = req.params;
  const userId = req.user.id;

  // Verificar que el usuario es admin
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (!membership || membership.role !== 'admin') {
    throw new AppError('Only group admins can remove members', 403);
  }

  // No permitir eliminar al creador del grupo
  const { data: group } = await supabase
    .from('groups')
    .select('created_by')
    .eq('id', groupId)
    .single();

  if (group && group.created_by === memberId) {
    throw new AppError('Cannot remove group creator', 400);
  }

  // Eliminar el miembro
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', memberId);

  if (error) {
    logger.error('Error removing member:', error);
    throw new AppError('Failed to remove member', 500);
  }

  logger.info(`User ${memberId} removed from group ${groupId}`);

  res.json({
    success: true,
    message: 'Member removed successfully'
  });
}));

/**
 * POST /api/groups/:groupId/leave
 * Salir del grupo (no puede ser el creador)
 */
router.post('/:groupId/leave', asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user.id;

  // Verificar que no sea el creador
  const { data: group } = await supabase
    .from('groups')
    .select('created_by')
    .eq('id', groupId)
    .single();

  if (!group) {
    throw new AppError('Group not found', 404);
  }

  if (group.created_by === userId) {
    throw new AppError('Group creator cannot leave. Delete the group instead.', 400);
  }

  // Eliminar membership
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) {
    logger.error('Error leaving group:', error);
    throw new AppError('Failed to leave group', 500);
  }

  logger.info(`User ${userId} left group ${groupId}`);

  res.json({
    success: true,
    message: 'Successfully left the group'
  });
}));

module.exports = router;

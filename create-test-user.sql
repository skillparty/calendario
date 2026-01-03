-- Crear un usuario de prueba para testing
INSERT INTO users (id, username, email, github_id)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'usuario_prueba',
    'prueba@ejemplo.com',
    'test123'
)
ON CONFLICT (github_id) DO NOTHING;

-- Verificar que se creó
SELECT * FROM users WHERE username = 'usuario_prueba';

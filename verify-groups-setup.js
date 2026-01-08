// Script de verificación del sistema de calendarios grupales
// Ejecutar en la consola del navegador (F12)

async function verifyGroupsSetup() {
  console.log('🔍 Iniciando verificación del sistema de grupos...\n');
  
  const results = {
    apiBaseUrl: false,
    backendHealth: false,
    backendVersion: false,
    authentication: false,
    groupsEndpoint: false,
    tablesCreated: false
  };
  
  try {
    // 1. Verificar API Base URL
    console.log('1️⃣ Verificando API Base URL...');
    const apiUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3000'
      : 'https://calendario-backend-one.vercel.app';
    console.log('   URL:', apiUrl);
    results.apiBaseUrl = true;
    
    // 2. Verificar salud del backend
    console.log('\n2️⃣ Verificando salud del backend...');
    try {
      const healthResponse = await fetch(`${apiUrl}/api/health`);
      const healthData = await healthResponse.json();
      console.log('   ✅ Backend respondiendo:', healthData.status);
      console.log('   Versión:', healthData.version);
      results.backendHealth = true;
    } catch (e) {
      console.error('   ❌ Error al conectar con el backend:', e.message);
    }
    
    // 3. Verificar versión del backend
    console.log('\n3️⃣ Verificando versión del backend...');
    try {
      const rootResponse = await fetch(`${apiUrl}/`);
      const rootData = await rootResponse.json();
      console.log('   Versión:', rootData.version);
      console.log('   Endpoints disponibles:', Object.keys(rootData.endpoints));
      
      if (rootData.endpoints.groups) {
        console.log('   ✅ Endpoint /api/groups registrado');
        results.backendVersion = true;
      } else {
        console.log('   ⚠️ Endpoint /api/groups NO encontrado en la lista');
      }
    } catch (e) {
      console.error('   ❌ Error:', e.message);
    }
    
    // 4. Verificar autenticación
    console.log('\n4️⃣ Verificando autenticación...');
    const userData = localStorage.getItem('calendarUser');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.jwt) {
          console.log('   ✅ Token JWT encontrado');
          console.log('   Usuario:', user.user?.username || 'No disponible');
          
          // Decodificar JWT (básico, sin validar firma)
          const parts = user.jwt.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            console.log('   User ID:', payload.userId);
            console.log('   Expira:', new Date(payload.exp * 1000).toLocaleString());
            
            // Verificar si el token ha expirado
            if (payload.exp * 1000 < Date.now()) {
              console.log('   ⚠️ TOKEN EXPIRADO - Necesitas cerrar sesión e iniciar sesión nuevamente');
            } else {
              results.authentication = true;
            }
          }
        } else {
          console.log('   ❌ No se encontró token JWT');
        }
      } catch (e) {
        console.error('   ❌ Error al parsear datos de usuario:', e.message);
      }
    } else {
      console.log('   ❌ No hay sesión activa. Inicia sesión primero.');
    }
    
    // 5. Probar endpoint de grupos (solo si hay autenticación)
    if (results.authentication) {
      console.log('\n5️⃣ Probando endpoint /api/groups...');
      try {
        const user = JSON.parse(localStorage.getItem('calendarUser'));
        const groupsResponse = await fetch(`${apiUrl}/api/groups`, {
          headers: {
            'Authorization': `Bearer ${user.jwt}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('   Status:', groupsResponse.status, groupsResponse.statusText);
        
        if (groupsResponse.ok) {
          const groupsData = await groupsResponse.json();
          console.log('   ✅ Endpoint funcionando correctamente');
          console.log('   Grupos actuales:', groupsData.data?.length || 0);
          results.groupsEndpoint = true;
          results.tablesCreated = true;
          
          if (groupsData.data && groupsData.data.length > 0) {
            console.log('\n   Tus grupos:');
            groupsData.data.forEach(g => {
              console.log(`   - ${g.name} (${g.user_role})`);
            });
          } else {
            console.log('   No tienes grupos aún. ¡Crea uno!');
          }
        } else {
          const errorText = await groupsResponse.text();
          console.error('   ❌ Error:', groupsResponse.status, errorText);
          
          if (groupsResponse.status === 401) {
            console.log('   💡 Sugerencia: Cierra sesión y vuelve a iniciar sesión');
          } else if (groupsResponse.status === 500) {
            console.log('   💡 Sugerencia: Verifica que las tablas se crearon en Supabase');
          }
        }
      } catch (e) {
        console.error('   ❌ Error al probar endpoint:', e.message);
      }
    } else {
      console.log('\n5️⃣ ⏭️ Omitiendo prueba de endpoint (no hay autenticación)');
    }
    
    // 6. Verificar UI de grupos
    console.log('\n6️⃣ Verificando componentes UI...');
    const calendarSelector = document.getElementById('calendar-selector');
    if (calendarSelector) {
      console.log('   ✅ Selector de calendario encontrado');
      console.log('   Visible:', calendarSelector.style.display !== 'none');
    } else {
      console.log('   ⚠️ Selector de calendario no encontrado en el DOM');
    }
    
    // Resumen final
    console.log('\n\n📊 RESUMEN DE VERIFICACIÓN\n' + '='.repeat(50));
    console.log('API Base URL:', results.apiBaseUrl ? '✅' : '❌');
    console.log('Backend Health:', results.backendHealth ? '✅' : '❌');
    console.log('Backend Version:', results.backendVersion ? '✅' : '❌');
    console.log('Autenticación:', results.authentication ? '✅' : '❌');
    console.log('Endpoint /api/groups:', results.groupsEndpoint ? '✅' : '❌');
    console.log('Tablas creadas:', results.tablesCreated ? '✅' : '❌');
    
    const allGood = Object.values(results).every(v => v === true);
    
    if (allGood) {
      console.log('\n🎉 ¡TODO ESTÁ FUNCIONANDO PERFECTAMENTE!');
      console.log('   Puedes crear grupos sin problemas.');
    } else {
      console.log('\n⚠️ HAY ALGUNOS PROBLEMAS:');
      
      if (!results.authentication) {
        console.log('   1. Inicia sesión con GitHub');
      }
      if (!results.backendHealth) {
        console.log('   2. Espera a que Vercel termine el deployment (~5 min)');
      }
      if (!results.groupsEndpoint) {
        console.log('   3. Verifica que la migración SQL se ejecutó correctamente');
        console.log('      Ve a Supabase → Table Editor y verifica que existan:');
        console.log('      - groups');
        console.log('      - group_members');
        console.log('      - group_invitations');
      }
    }
    
    console.log('\n' + '='.repeat(50));
    
    return results;
    
  } catch (error) {
    console.error('\n❌ Error durante la verificación:', error);
    return results;
  }
}

// Ejecutar verificación
console.log('🚀 Ejecutando verificación del sistema de grupos...\n');
verifyGroupsSetup().then(results => {
  console.log('\n✨ Verificación completada');
  window.groupsVerificationResults = results;
});

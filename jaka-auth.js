/* JAKA Virtual: sesión real, roles y paneles. Va en index.html DESPUÉS del script principal:
   <script src="/jaka-auth.js"></script> */
(()=>{
const ROLES=['Administrador','Docente','Estudiante'];
const ICO={cursos:'book-open',tareas:'clipboard-check',examenes:'file-question',calificaciones:'award',materiales:'folder-open',calendario:'calendar-days',avisos:'bell'};
const MAPA={cursos:'courses',tareas:'tasks',examenes:'exams',calificaciones:'grades',materiales:'materials',calendario:'calendar',avisos:'notifs'};
const DESC={cursos:'Crea y organiza cursos, unidades y estudiantes matriculados.',tareas:'Publica tareas, fija fechas de entrega y revisa lo recibido.',examenes:'Programa exámenes y cuestionarios.',calificaciones:'Registra y consulta las notas.',materiales:'Sube documentos, presentaciones y videos.',calendario:'Consulta entregas, exámenes y eventos.',avisos:'Publica avisos importantes.'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url,m='GET',b){const r=await fetch(url,{method:m,headers:b?{'Content-Type':'application/json'}:{},body:b?JSON.stringify(b):undefined,credentials:'same-origin'});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.mensaje||'Error del servidor');return d}
function cargar(url,fn){const v=S.view;api(url).then(d=>{const e=$('#dato');if(e&&S.view===v){e.innerHTML=fn(d);L()}}).catch(x=>{const e=$('#dato');if(e)e.innerHTML=emp('alert-triangle','No se pudo cargar',esc(x.message))})}
const tabla=(cab,filas,min=560)=>`<div class="grade-table-wrap"><table class="grade-table" style="min-width:${min}px"><thead><tr>${cab.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table></div>`;
const estado=u=>chip(u.activo?'Activo':'Inactivo',u.activo?'var(--ok)':'var(--er)');

/* ---- entrada, rol y navegación ---- */
async function entrar(u){S.user=u;S.name=u.nombre+' '+u.apellido;try{S.ap=(await api('/api/apartados')).apartados}catch{S.ap=[];toast('error','No se pudieron cargar los apartados.')}
 S.view=u.rol==='Estudiante'?'home':u.rol==='Docente'?'dinicio':'ainicio';closeM();shell()}
const shell0=window.shell;window.shell=function(){shell0();adaptar()};
const view0=window.view;window.view=function(k){view0(k);resaltar()};
function resaltar(){const k=S.view==='espacio'?'esp_'+S.esp:S.view;document.querySelectorAll('.nv[data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===k||(S.view==='course'&&b.dataset.v==='courses')))}
function adaptar(){const u=S.user;if(!u)return;const ap=S.ap||[],side=$('#side');
 const items=u.rol==='Estudiante'?[['home','Inicio','layout-dashboard'],...ap.filter(a=>MAPA[a.clave]).map(a=>[MAPA[a.clave],a.nombre,ICO[a.clave]]),['profile','Perfil','user-round'],['help','Ayuda y soporte','life-buoy']]
 :u.rol==='Docente'?[['dinicio','Inicio','layout-dashboard'],...ap.map(a=>['esp_'+a.clave,a.nombre,ICO[a.clave]||'folder']),['estudiantes','Estudiantes','users'],['help','Ayuda y soporte','life-buoy']]
 :[['ainicio','Administración','shield-check'],['ausuarios','Usuarios','user-cog'],['estudiantes','Estudiantes','users'],['aapartados','Apartados','layout-list']];
 side.querySelectorAll('.nv[data-v]').forEach(n=>n.remove());
 side.querySelector('div[style*="flex"]').insertAdjacentHTML('beforebegin',items.map(i=>`<button class="nv" data-a="go:${i[0]}" data-v="${i[0]}">${ic(i[2])}<span class="tx">${esc(i[1])}</span></button>`).join(''));
 const r=side.querySelector('.me .mu');if(r)r.textContent=u.rol;
 if(u.rol!=='Estudiante')document.querySelectorAll('label.sr,.top .ico[aria-label="Notificaciones"]').forEach(e=>e.style.display='none');
 L();view(true)}
const go0=A.go;A.go=v=>{if(v.startsWith('esp_')){S.esp=v.slice(4);v='espacio'}if(v==='aapartados')S.apAdm=null;go0(v)};

/* ---- 1) inicio de sesión y 2) registro de estudiantes ---- */
A.login=async(x,b)=>{const c=$('#em').value.trim().toLowerCase(),p=$('#pw').value;if(!c||!p){toast('error','Escribe tu correo y contraseña.');return}
 busy(b,'Entrando…');try{const d=await api('/api/auth/login','POST',{correo:c,password:p});await entrar(d.usuario);toast('ok','Bienvenido, '+d.usuario.nombre)}catch(e){b.disabled=false;b.textContent='Iniciar sesión';toast('error',e.message)}};
A.register=async(x,b)=>{const n=$('#first').value.trim(),a=$('#last').value.trim(),c=$('#em').value.trim().toLowerCase(),p=$('#pw').value;
 if(!n||!a||!/^\S+@\S+\.\S+$/.test(c)||p.length<8){toast('error','Completa nombre, apellido, correo válido y una contraseña de 8 caracteres.');return}
 busy(b,'Creando…');try{const d=await api('/api/estudiantes/registro','POST',{nombre:n,apellido:a,correo:c,password:p});await entrar(d.usuario);toast('ok','Cuenta creada. ¡Bienvenido!')}catch(e){b.disabled=false;b.textContent='Crear cuenta';toast('error',e.message)}};
A.logout=async()=>{try{await api('/api/auth/logout','POST',{})}catch{}S.user=null;S.ap=null;landing()};
const lm=A.loginm;A.loginm=()=>{lm();const h=[...document.querySelectorAll('.auth-help')].pop();if(h)h.textContent='Tus datos se guardan en la base de datos de JAKA Virtual; la contraseña se almacena cifrada.'};

/* ---- espacios del docente ---- */
V.dinicio=()=>`<div class="hh"><div><div class="mu sm">Panel del docente</div><h1>Hola, ${esc(S.user.nombre)}</h1><p class="mu">Estos son tus espacios de trabajo. Se irán llenando a medida que se conecten a la base de datos.</p></div></div><div class="g g3">${(S.ap||[]).map(a=>`<button class="card" data-a="go:esp_${a.clave}" style="text-align:left;cursor:pointer"><span class="ib">${ic(ICO[a.clave]||'folder')}</span><h3 style="margin:12px 0 4px;font-size:17px">${esc(a.nombre)}</h3><p class="mu sm">${esc(DESC[a.clave]||'')}</p></button>`).join('')}<button class="card" data-a="go:estudiantes" style="text-align:left;cursor:pointer"><span class="ib">${ic('users')}</span><h3 style="margin:12px 0 4px;font-size:17px">Estudiantes</h3><p class="mu sm">Consulta los estudiantes registrados.</p></button></div>`;
V.espacio=()=>{const a=(S.ap||[]).find(x=>x.clave===S.esp)||{nombre:'Apartado',clave:S.esp};return`<h1 class="t">${esc(a.nombre)}</h1><p class="mu" style="margin-bottom:18px">${esc(DESC[a.clave]||'')}</p><div class="card">${emp(ICO[a.clave]||'folder','Espacio preparado','Todavía no hay registros. Aquí aparecerán cuando este apartado se conecte a la base de datos.')}</div>`};
V.estudiantes=()=>{cargar('/api/estudiantes',d=>d.estudiantes.length?tabla(['Nombre','Apellido','Correo','Estado'],d.estudiantes.map(u=>`<tr><td><b>${esc(u.nombre)}</b></td><td>${esc(u.apellido)}</td><td>${esc(u.correo)}</td><td>${estado(u)}</td></tr>`)):emp('users','Aún no hay estudiantes','Cuando alguien se registre aparecerá aquí.'));
 return`<h1 class="t">Estudiantes registrados</h1><p class="mu" style="margin-bottom:18px">Consulta quién tiene cuenta de estudiante.</p><div id="dato" class="card">Cargando…</div>`};

/* ---- 3) panel del administrador ---- */
V.ainicio=()=>{cargar('/api/admin/usuarios',d=>`<div class="g gs">${ROLES.map(r=>`<div class="card st"><span class="mu sm">${r}s</span><b>${d.usuarios.filter(u=>u.rol===r).length}</b></div>`).join('')}</div>`);
 return`<div class="hh"><div><div class="mu sm">Panel del administrador</div><h1>Administración</h1><p class="mu">Gestiona usuarios y organiza los apartados del aula virtual.</p></div></div><div id="dato">Cargando…</div><div class="row wrap" style="margin-top:18px"><button class="btn pri" data-a="go:ausuarios">Gestionar usuarios</button><button class="btn" data-a="go:aapartados">Organizar apartados</button></div>`};
V.ausuarios=()=>{cargar('/api/admin/usuarios',d=>{S.usr=d.usuarios;return tabla(['Usuario','Correo','Rol','Acceso'],d.usuarios.map(u=>`<tr><td><b>${esc(u.nombre)} ${esc(u.apellido)}</b></td><td>${esc(u.correo)}</td><td><select class="js-rol" data-id="${u.id}" ${u.id===S.user.id?'disabled':''}>${ROLES.map(r=>`<option ${r===u.rol?'selected':''}>${r}</option>`).join('')}</select></td><td>${u.id===S.user.id?chip('Tu cuenta','var(--a)'):`${estado(u)} <button class="btn sm" data-a="toggleusr:${u.id}">${u.activo?'Desactivar':'Activar'}</button>`}</td></tr>`),680)});
 return`<h1 class="t">Usuarios</h1><p class="mu" style="margin-bottom:18px">Crea cuentas y controla el rol y el acceso de cada persona.</p><div class="card" style="margin-bottom:18px"><b>Nuevo usuario</b><div class="g g3" style="margin:10px 0"><label>Nombre<input class="fi" id="nu_n" autocomplete="off"></label><label>Apellido<input class="fi" id="nu_a" autocomplete="off"></label><label>Correo<input class="fi" id="nu_c" type="email" autocomplete="off"></label><label>Contraseña (8+)<input class="fi" id="nu_p" type="password" autocomplete="new-password"></label><label>Rol<select class="fi" id="nu_r">${ROLES.map(r=>`<option ${r==='Docente'?'selected':''}>${r}</option>`).join('')}</select></label></div><button class="btn pri" data-a="crearusr">Crear usuario</button></div><div id="dato">Cargando…</div>`};
A.crearusr=async(x,b)=>{const v=i=>$('#'+i).value.trim();if(!v('nu_n')||!v('nu_a')||!/^\S+@\S+\.\S+$/.test(v('nu_c'))||$('#nu_p').value.length<8){toast('error','Completa todos los campos; la contraseña necesita 8 caracteres.');return}
 busy(b,'Creando…');try{await api('/api/admin/usuarios','POST',{nombre:v('nu_n'),apellido:v('nu_a'),correo:v('nu_c').toLowerCase(),password:$('#nu_p').value,rol:$('#nu_r').value});toast('ok','Usuario creado.');view(true)}catch(e){b.disabled=false;b.textContent='Crear usuario';toast('error',e.message)}};
A.toggleusr=async id=>{const u=(S.usr||[]).find(x=>x.id==id);if(!u)return;try{await api('/api/admin/usuarios/'+id,'PATCH',{activo:!u.activo});toast('ok',u.activo?'Acceso desactivado.':'Acceso activado.')}catch(e){toast('error',e.message)}view(true)};
document.addEventListener('change',async e=>{if(!e.target.classList.contains('js-rol'))return;try{await api('/api/admin/usuarios/'+e.target.dataset.id,'PATCH',{rol:e.target.value});toast('ok','Rol actualizado.')}catch(x){toast('error',x.message)}view(true)});
V.aapartados=()=>{if(!S.apAdm){api('/api/apartados').then(d=>{S.apAdm=d.apartados;view(true)}).catch(e=>toast('error',e.message));return`<h1 class="t">Apartados del aula</h1><div class="card">Cargando…</div>`}
 const L2=S.apAdm;return`<h1 class="t">Apartados del aula</h1><p class="mu" style="margin-bottom:18px">Define qué apartados ven docentes y estudiantes y en qué orden. Inicio, Perfil y Ayuda siempre están disponibles.</p><div class="card">${L2.map((a,i)=>`<div class="li"><span class="ib">${ic(ICO[a.clave]||'folder')}</span><div><b>${esc(a.nombre)}</b><div class="mu sm">${a.visible?'Visible':'Oculto'}</div></div><button class="btn sm" data-a="apsube:${i}" ${i?'':'disabled'} aria-label="Subir">${ic('arrow-up')}</button><button class="btn sm" data-a="apbaja:${i}" ${i<L2.length-1?'':'disabled'} aria-label="Bajar">${ic('arrow-down')}</button><button class="btn sm" data-a="apvis:${i}">${a.visible?'Ocultar':'Mostrar'}</button></div>`).join('')}</div><button class="btn pri" style="margin-top:16px" data-a="apguardar">Guardar cambios</button>`};
const mover=(i,j)=>{const l=S.apAdm;[l[i],l[j]]=[l[j],l[i]];view(true)};
A.apsube=i=>mover(+i,+i-1);A.apbaja=i=>mover(+i,+i+1);A.apvis=i=>{S.apAdm[+i].visible=!S.apAdm[+i].visible;view(true)};
A.apguardar=async(x,b)=>{busy(b,'Guardando…');try{await api('/api/admin/apartados','PUT',{apartados:S.apAdm.map(a=>({clave:a.clave,visible:a.visible}))});toast('ok','Apartados guardados.')}catch(e){toast('error',e.message)}b.disabled=false;b.textContent='Guardar cambios'};

/* ---- recuperar la sesión al abrir la página ---- */
api('/api/auth/sesion').then(d=>entrar(d.usuario)).catch(()=>{});
})();

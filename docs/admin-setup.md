# Activar la administración de la cartilla

El panel está en `/admin.html` en el mismo dominio que la cartilla. Para guardar cambios necesita la Function `/api/admin` de Vercel y un usuario autorizado en Supabase Auth. El HTML puede abrirse públicamente; los datos administrativos y todas las escrituras requieren una sesión verificada y autorización en el servidor.

## 1. Crear tu usuario

En el proyecto **Cartilla-Medica** de Supabase:

1. Abrir **Authentication → Users → Add user → Create new user**.
2. Ingresar tu correo y una contraseña elegida por vos. Confirmar el correo (o usar la opción de confirmación automática al crear el usuario desde el dashboard).
3. Copiar el **User UID** del usuario creado. Es el UUID de Auth, no el ID de un profesional.

No hace falta habilitar el registro público ni cambiar las políticas de las tablas. El panel no ofrece registro ni permite que cualquier usuario autenticado escriba.

## 2. Configurar Vercel

En el proyecto que publica esta cartilla, abrir **Settings → Environment Variables** y agregar para **Production**:

| Variable | Valor |
| --- | --- |
| `ADMIN_USER_IDS` | El User UID copiado. Para varios administradores, separar UUID por coma. |
| `SUPABASE_SERVICE_ROLE_KEY` | La clave JWT `service_role` del mismo proyecto de Supabase, disponible en la sección de claves API heredadas/legacy de su configuración. Marcarla como Secret/Sensitive según la interfaz. |

La clave `service_role` se configura únicamente en Vercel. **No pegarla en `js/env.js`, archivos del repositorio, informes ni mensajes.** El código del navegador sigue usando la clave pública existente. La contraseña se ingresa solamente en Supabase al crear la cuenta y en el formulario de inicio de sesión.

El proyecto debe mantener el framework **Other**, la raíz del repositorio que contiene `index.html` y la salida estática de la raíz (sin cambiarla a `data` o a `public`). Se agregaron `package.json` y `vercel.json` para la Function Node; no hay dependencias que instalar ni paso de compilación. Si Vercel tenía configurada una salida o compilación personalizada, verificar que también publique `/admin.html` y despliegue `/api/admin`.

Subir los cambios a GitHub y crear un nuevo deployment con las variables ya configuradas. Las variables nuevas no se aplican a deployments anteriores. No hacen falta tokens de Vercel dentro del repositorio ni migraciones de la base.

## 3. Revisar y guardar

1. Ejecutar la revisión semanal desde **GitHub Actions → Revisar diferencias con Circulo Medico**.
2. Descargar y descomprimir el artifact `revision-profesionales`.
3. Entrar a `https://TU-DOMINIO/admin.html` e iniciar sesión.
4. Cargar **revision-profesionales.json** (no el HTML ni el ZIP).
5. Buscar el caso. Si hay varias coincidencias, elegir explícitamente la persona del origen.
6. Marcar solamente los campos deseados: **Nombre, Especialidad, Dirección, Teléfono**. Ninguno viene aprobado de antemano. Los valores propuestos se pueden corregir.
7. Elegir **Revisar cambios seleccionados**, comprobar actual/nuevo y presionar **Confirmar y guardar**.

**Conservar datos actuales** marca el caso como revisado sin escribir en Supabase. **Marcar todos los valores disponibles** marca los cuatro campos que tengan un valor válido, pero no guarda todavía. Los campos con valores idénticos se omiten al guardar.

La especialidad se vincula a una categoría existente de tu cartilla. Si la especialidad del origen no coincide con una categoría conocida, hay que elegirla manualmente; no se crean ni renombran categorías compartidas. Localidad y certificado médico digital no se modifican desde esta revisión.

## Comportamiento y límites

- El servidor verifica el token con Supabase Auth en cada petición y controla el UUID contra `ADMIN_USER_IDS`. Nunca confía en permisos enviados por el navegador.
- Se actualiza por ID y con todos los valores originales como condiciones en el mismo UPDATE. Si otro cambio ocurrió, se rechaza con conflicto en lugar de sobrescribirlo.
- Los informes antiguos se comparan con los datos actuales. Si no se encuentra un único registro con los mismos datos originales, el caso queda bloqueado para escritura. Generar una nueva revisión.
- Las decisiones y borradores se conservan en **este navegador**; no se sincronizan entre dispositivos. Se puede descargar el historial para conservar los datos anteriores y los campos aplicados. Los cambios exitosos también quedan en los logs privados de la Function.
- El token se mantiene solamente en memoria: al recargar o cerrar la página hay que volver a iniciar sesión. Si vence durante la revisión, el panel pide ingresar nuevamente. Las decisiones locales se conservan.
- La cartilla consultada en línea refleja los cambios de inmediato al recargarse. El respaldo JSON publicado se actualiza con la tarea diaria; para adelantarlo, ejecutar manualmente **Actualizar respaldo de la cartilla** en Actions y verificar el deployment de Vercel.
- El panel necesita Supabase activo para iniciar sesión y guardar. El respaldo público permite leer la cartilla si Supabase se pausa, pero no permite administrar la base pausada.

## Verificación

Pruebas de lógica y autorización:

```powershell
npm.cmd test
```

Prueba completa de navegador con datos simulados locales (no escribe en Supabase):

```powershell
node tests/browser-smoke.mjs
```

La prueba requiere Chrome instalado; para otra ubicación, configurar `CHROME_PATH`. Usa `.qa/`, ignorada por Git, para el perfil temporal y las capturas. No usar contraseñas ni claves reales en esta prueba.

La activación real debe comprobarse después del deployment: un visitante sin sesión no puede obtener datos desde `/api/admin`, tu usuario autorizado puede iniciar sesión y la confirmación muestra solo los campos elegidos. Si aparece un error de configuración, revisar las dos variables y volver a desplegar.

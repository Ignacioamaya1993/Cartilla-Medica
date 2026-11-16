# Cartilla medica

La web consulta Supabase y, si falla o demora mas de 8 segundos, muestra data/profesionales.json. La copia incluye las categorias relacionadas y solo los campos publicos de la cartilla. La fecha visible indica cuando se genero la copia; no indica cuando se modificaron los registros.

## Actualizar el respaldo

Desde la carpeta Cartilla-Medica-master (la que contiene index.html), ejecutar con Node.js 22.19 o posterior:

    node --use-system-ca scripts/update-snapshot.mjs

Supabase debe estar activo. Se reutiliza js/env.js y su clave publica; no se necesita service_role. El comando descarga todas las paginas y reemplaza el JSON solo al completar y validar la descarga. Si falla o devuelve una lista vacia, conserva la copia anterior.

Publicar data/profesionales.json junto con los demas archivos del sitio despues de cada cambio en la cartilla. La copia no se actualiza sola desde el navegador. Si Supabase esta pausado, la copia publicada continua funcionando, aunque puede tener datos anteriores. Para generar una nueva copia hay que reactivar Supabase.

Probar la web mediante un servidor HTTP, no abriendo index.html como archivo local. Para comprobar el respaldo, bloquear el dominio de Supabase desde las herramientas de red del navegador y recargar: debe aparecer la fecha de la copia guardada y funcionar filtros, paginacion y fichas.

## Actualizacion automatica con GitHub Actions

El workflow .github/workflows/update-directory.yml consulta Supabase todos los dias a las 09:23 de Argentina (puede haber demoras del programador de GitHub). Tambien admite ejecucion manual desde Actions > Actualizar respaldo de la cartilla > Run workflow.

Descarga profesionales y sus categorias; si los datos cambiaron, guarda solo data/profesionales.json en la rama predeterminada. Si siguen iguales, conserva el archivo y su fecha de generacion. Si la consulta falla, no modifica el respaldo y la ejecucion figura como fallida. No necesita instalar dependencias ni configurar tokens de Supabase/Vercel: usa la clave publica de js/env.js y el GITHUB_TOKEN automatico para guardar el JSON.

Para activarlo:

1. Subir los cambios locales (incluidos .github/workflows, scripts, js/data-source.js y data) a la rama predeterminada del repositorio. Esta carpeta, que contiene index.html y .git, es la raiz del repositorio.
2. En GitHub, verificar que Actions este habilitado y que las politicas permitan contents: write al workflow. Si la rama tiene protecciones que impiden pushes del bot, se debe adaptar el flujo a esas reglas; no desactivar protecciones sin evaluarlas.
3. Ejecutarlo manualmente una vez y comprobar que la consulta termina correctamente.
4. Si se genera un commit, comprobar el despliegue en Vercel. Debe estar conectado a este repositorio y usar la misma rama para produccion. Restricciones del proyecto o del autor del commit pueden impedir el despliegue automatico; revisar su estado en Vercel.

No se ha activado esta tarea remota solo por crear el archivo local. No reactiva un proyecto que ya este pausado: primero restaurarlo desde Supabase. Generar actividad diaria puede reducir las pausas por inactividad del plan gratuito, pero no es una garantia contractual.

En repositorios publicos, GitHub desactiva las ejecuciones programadas tras 60 dias sin actividad en el repositorio. Consultar Supabase sin cambios no genera commits y no evita esa limitacion: revisar Actions y reactivar la tarea si se deshabilita. El JSON sigue disponible aun si falla la automatizacion.

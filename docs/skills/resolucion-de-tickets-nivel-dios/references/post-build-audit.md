# Auditoría crítica después del build · contrato v1

**Momento:** cuando termina el implementador («viejito» o la sesión principal),
después de las siete lentes cuando correspondan y **antes de declarar resuelto,
archivar o entregar como verificado**. Es una revisión final del resultado, no
una octava iteración ni permiso para lanzar otro agente. Si hay revisión delegada
autorizada, entrega hallazgos al responsable; éste integra y verifica los fixes.

## 1. Fijar el resultado que realmente se va a revisar

Lee el pedido vigente, todos los criterios/pasos del plan, diff, README, memoria
y reporte del build recién terminado. Identifica versión/huella, árbol servido,
runtime, datos, rol, contexto y ambiente. No elijas «el último reporte» por fecha
sin vincularlo al trabajo. Un reporte es una lista de afirmaciones por comprobar,
no prueba automática. Todo cambio posterior invalida los checks afectados.

## 2. Confrontar cada promesa con realidad

Haz una fila por criterio/feature implementada del alcance: esperado → recorrido
o comando ejecutable → actual → estado → evidencia → versión/ambiente. Incluye
lo parcial y los pasos aún abiertos; no inventes features. Abre capturas y compara
pantalla, respuesta y persistencia. No deduzcas «funciona» leyendo solamente código.

## 3. Atacar los puntos donde suele quedar trabajo a medias

Selecciona los casos pertinentes, no una suite global automática:

- Login/permiso/contexto → navegar → actuar → guardar → recargar → revisitar →
  resultado de negocio. Verifica primer render, lazy-load, versión servida,
  selector con contexto, teclado/foco, solapes, CTAs y feedback verdadero.
- Vacío, validación, cancelar/Back, respuesta perdida, reintentar y estado terminal:
  sin duplicados, loops de red, operaciones imposibles ni pérdida del borrador.
- Edición parcial: valida el estado final combinado, no sólo campos del PATCH.
  Borrar a mano debe seguir borrado; reimportar una fuente vieja no revierte
  cambios manuales. Identidad compuesta/tipo y candidatos ambiguos no se resuelven
  por orden accidental. «0» válido no equivale a vacío; desconocido no equivale a cero.
- Ingesta/procesos: ruta real, usuario del servidor, permisos, worker y persistencia;
  ejecución inline/fixture verde no prueba un job despachado. Conserva selección
  múltiple y shortcuts; terminales cancelados/fallidos ofrecen recuperación válida.
- Autorización, CSRF/propiedad, aislamiento de datos, originales/hashes/históricos
  y logs sin secretos. Mide rendimiento si se prometió velocidad, con volumen realista.

Browser real para UI; Android reservado para alcance móvil, sin convertir emulación
en evidencia nativa. Pruebas sintéticas identificables y repetibles; un fallo del
harness se registra y se arregla, no se cuenta como PASS de la app. Nunca reemplaces
la aceptación requerida por fixtures ni envíes dinero/mensajes como QA implícita.

## 4. Corregir lo demostrado y repetir exactamente lo que falló

Por hallazgo: ID, severidad, reproducción, esperado/actual, causa, fix, archivos y
check posterior. Dentro del alcance autorizado, repara de forma conservadora;
añade regresión pertinente y repite el recorrido original + vecinos afectados.
No devuelvas al dueño tareas recuperables ya autorizadas. Si es destructivo, fuera
de alcance o falta autoridad, conserva el hallazgo y el bloqueo factual; no improvises
permisos. No rediseñes el producto para esconder el fallo.

## 5. Reconciliar evidencia y documentación del resultado final

Actualiza el mismo reporte/memoria/README/índice con fixes y checks posteriores.
Cada comando publicado debe ser ejecutable, cada enlace existir y la evidencia
tener contenido. Versiona sólo evidencia sanitizada destinada a respaldo; comprueba
`git check-ignore`/`git ls-files` antes de afirmar que viajó en el commit. No dupliques
totales sumando reruns. Separa clon/prod/browser/Android, build/aceptación y benchmarks.

## 6. Gate antes del cierre

Guarda un manifiesto pequeño junto a la evidencia y ejecuta:

```bash
python3 <skill>/scripts/check-post-build-audit.py <audit.json> --project <repo> --build-id <huella-revisada>
```

El manifiesto v1 usa estos campos (rutas relativas al repo; IDs únicos):

```json
{
  "schema_version": 1,
  "build": {"id": "huella-revisada", "environment": "clon + runtime comprobado", "report": "docs/reports/reporte.md", "files": [{"path": "ruta/archivo-afectado", "sha256": "SHA256-real-de-64-caracteres"}]},
  "requirements": [{"id": "R1", "description": "resultado observable", "check_ids": ["C1"]}],
  "checks": [{"id": "C1", "requirement_ids": ["R1"], "status": "PASS", "build_id": "huella-revisada", "environment": "clon", "method": "browser", "command_or_steps": "pasos ejecutados", "expected": "resultado esperado", "actual": "resultado observado", "evidence": ["docs/reports/evidence/resultado.json"]}],
  "findings": []
}
```

Estados de check: `PASS/FAIL/PARTIAL/SKIPPED/BLOCKED`. Hallazgo:
`id/severity/status/requirement_ids/reproduction/expected/actual/cause`; `FIXED` añade `fix` y
`verification_check_ids`; `OPEN/DEFERRED/OUT_OF_SCOPE` añade `reason`.
Severidad: `BLOCKER/HIGH/MEDIUM/LOW`. Un OUT_OF_SCOPE requiere justificar el límite;
usa `requirement_ids: []`; no puedes reclasificar un criterio del pedido para
obtener verde. Cada fix debe tener regresión PASS para todos sus criterios afectados.

Exit **0 PASS**: criterios y regresiones vinculados pasan sobre la versión actual,
sin hallazgos en alcance pendientes. **2 FAIL**: fallo funcional, integridad/evidencia
inválida, falta de cobertura o bug abierto. **3 PARTIAL**: check requerido sin
ejecutar/completo o fix diferido. Los hallazgos OUT_OF_SCOPE siguen visibles.
El helper verifica estructura, enlaces, hashes y coherencia; **no acredita que los
pasos declarados se ejecutaron** ni certifica la app. Revisa outputs/capturas reales.

## 7. Entregar el veredicto, no el optimismo del implementador

Sólo cierra como verificado con gate PASS y prueba real de cada criterio. PARTIAL,
SKIPPED, deuda documental del alcance o aceptación pendiente no son resuelto.
Archiva sólo conforme a autorización/estado real. Reporta fixes, evidencia fresca,
riesgos y siguiente paso; conserva originales y trabajo ajeno. No hay garantía
de cero bugs futuros: hay una salida auditable y límites explícitos.

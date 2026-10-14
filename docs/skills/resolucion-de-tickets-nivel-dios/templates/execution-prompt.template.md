Usa $resolucion-de-tickets-nivel-dios del proyecto /lamp/www/ABRN-Drive.
Lee primero /lamp/www/ai_tools/FILEMON_PHILOSOPHY_STANDALONE_AGENT_BRIEF.md
como filosofía práctica, y confirma claridad, evidencia y cambios pequeños.

## Contexto

Lee README.md, docs/trust-copy-contract.md, la memoria/reporte relevantes más recientes y este
índice con todos sus pasos:

------------------------------------------------------
REPLACE WITH THE INDEX FILE PATH OF THE PLAN TO BUILD
------------------------------------------------------

El plan define la intención; el repositorio y la reproducción actual definen
la realidad. Conserva comportamiento válido si un supuesto del plan es viejo.
Aplica las instrucciones actuales del dueño antes que esta plantilla. Generar
este texto no autoriza ejecutar el plan ni amplía los permisos de la sesión.

## Pedido antes que interpretación

Lee en el skill el «Contrato de fidelidad» y fija la fila pedido literal → resultado
observable → invariantes → prueba. No sustituyas un componente/diseño solicitado
por una alternativa no autorizada. Las correcciones del dueño actualizan la fila.
Todo paso del índice conserva su estado y evidencia: un bucle de siete lentes
no declara terminado un roadmap incompleto. Si falta trabajo recuperable, continúa.

## Límites ABRN-Drive (VaultDrive)

- Sesión principal, main; conserva archivos ajenos. Sin flotas ni agentes
  para prosa. Respeta el presupuesto de tokens y no infles la documentación.
- Go backend (`cmd/vaultdrive`, `internal/`) + React 18/TypeScript/Vite (`vaultdrive_client/`).
  Respeta la frontera de despliegue de `deploy/release/`.
- No suite completa (`npm run test` global) salvo solicitud expresa.
  Sólo checks pertinentes (`npm run typecheck`, `npx vitest run <suite>`, `go test ./...`, `npm run build`); conserva el gate de aceptación en vivo vigente.
- Conserva la frontera Zero-Knowledge (`SessionVaultProvider`, `scrub()`, llaves en `#fragment`, sellos SHA-256) y `docs/trust-copy-contract.md`.
- Lee los skills locales `experiencia-de-barrio-nivel-dios`, `filemon-modal-uix`, `21-brenda-executive-modal-dock` y `skill-for-filemon-or-something` para UI.

## Bucle de siete lentes — sin vueltas ficticias

En cada vuelta lee el hallazgo anterior, aplica su lente, realiza el cambio
seguro necesario y registra la verificación pertinente con exit/HTTP y evidencia.
No repitas una corrida para fingir progreso. Si no corresponde cambiar código,
registra lo revisado, prueba obtenida y límite real; no inventes una mejora.

1. **Recon y fundamento:** reproduce el ticket con el contexto real (cuenta,
   impersonación, entidad, semana, mes, BAIT, socio/corte). Mapea UI → endpoint
   → servicio → persistencia, determina causa y baseline.
2. **Corrección central:** implementa el menor arreglo que permita completar
   el resultado principal; reutiliza contratos y componentes vigentes.
3. **Bordes y recuperación:** verifica vacíos, entradas inválidas, cancelación,
   pérdida de respuesta y reintento sin duplicar operaciones ni perder datos.
4. **Profundidad de prueba:** añade/ajusta regresión enfocada si está autorizada;
   prueba resultado guardado, recarga y revisita. Conserva unit/integration
   existentes; browser añade evidencia y no los sustituye.
5. **Coherencia UX:** verifica selector con contexto, visor utilizable, CTAs
   alcanzables, cero solapes, feedback, errores recuperables y retorno al mismo
   alcance. Mide el viewport real; no escondas campos para afirmar cero scroll.
6. **Seguridad y operación:** comprueba rol/propiedad, scope de empresa, CSRF,
   invariantes monetarias/fuentes, logs sin secretos y latencia cuando aplique.
   No anuncies cifras de rendimiento que no mediste.
7. **Verificación y preparación de cierre:** repite el recorrido fallido en navegador desde
   estado frío, relee diff/evidencia y documenta resultados y límites.
   La resolución espera la auditoría siguiente.

## Evidencia de usuario

Con BrowserSkill/Playwright camina el flujo afectado de verdad:
login → navegar → actuar → persistir → recargar → volver → resultado de negocio.
Incluye negativos relevantes, errores consola/red y capturas útiles.
Si es móvil, usa un Android reservado mediante el skill disponible; un
viewport estrecho no cuenta como interacción en teléfono. Documenta cualquier
ambiente o paso que no pudiste verificar.

Un fixture verde no certifica la pantalla del usuario. Verifica el primer render,
lazy-load, preferencias guardadas y la versión servida cuando afecten al fallo.
Mantén aparte evidencia de clon, producción, Android y aceptación del dueño.

## Auditoría crítica post-build — después del implementador

Cuando termine viejito o la implementación en esta sesión, ejecuta íntegramente
`references/post-build-audit.md` del skill antes de resolver/archivar/entregar como
verificado. Es un gate final, no una octava iteración ni otro agente obligatorio.
El reporte inicial es una lista de claims por comprobar: revisa el build exacto,
todos los criterios/pasos del pedido, diff, UI real, runtime y persistencia.

Reproduce lo roto/incompleto, identifica causa y corrige dentro del alcance;
repite el recorrido fallido y regresiones pertinentes sobre la versión corregida.
Incluye recuperación, permisos, workers, datos, claridad y rendimiento prometido.
No recicles evidencia anterior para una versión modificada ni cuentes reruns doble.
Actualiza reporte/memoria/README/índice y enlaces/artefactos respaldados. Conserva
límites de suite, producción, Android y contactos; no sustituyas autorización.
Guarda el manifiesto v1 junto a la evidencia del reporte y ejecuta el helper
`scripts/check-post-build-audit.py <audit.json> --project /lamp/www/nanored --build-id <huella-revisada>`.
Un FAIL/PARTIAL, paso abierto o aceptación pendiente bloquea cierre verificado.
El helper valida coherencia/hashes; sólo la evidencia real acredita los recorridos.

## Cierre — sólo después de auditar

Escribe memoria breve en docs/memories/session-YYYY-MM-DD-<slug>.md y reportes
MD/HTML en docs/reports/YYYY-MM-DD-<slug>-verification.{md,html}; enlaza desde
README. Cada claim lleva método, resultado y evidencia; los fallos no se ocultan.
Stage sólo el trabajo, commit semántico en main, push sólo según instrucción
vigente. Conserva suciedad ajena. Limpia únicamente fixtures/procesos propios
cuando sea seguro. Reporta el hash, pruebas, riesgos y siguiente paso útil.

Termina cuando el resultado autorizado esté comprobado, no por un build verde
ni por agotar un número de vueltas. No certifiques lo que quedó sin verificar.

Comprueba todos los criterios del pedido y estados del índice antes del cierre.
Documentación requerida faltante/obsoleta o enlaces rotos son fallo de entrega.
Archivar no equivale a resolver. Si el push está autorizado, inspecciona triggers CI,
respeta el hold de suites y verifica SHA remoto; no eludas hooks ni protecciones.
No sugieras como siguiente paso el trabajo autorizado que dejaste sin terminar.

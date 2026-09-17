# Step 6: Interactive Breadcrumb Lateral Jumping & Origin Provenance Cards

## Overview
Polish navigational velocity and cryptographic observability. Breadcrumb navigation currently only allows navigating upward to ancestor folders. Switching to a sibling folder requires finding it in the sidebar. Concurrently, origin badges (`Drop: RG Consulting`, `Vault`) display basic text pills without surfacing the intake audit trail. This step transforms breadcrumbs into active lateral jump menus and equips origin badges with rich provenance hover cards.

---

## Detailed Technical Objectives

### 1. Interactive Breadcrumb Sibling Dropdowns in `files.tsx`
* **Architecture**:
  - Replace static breadcrumb crumbs with an interactive composite component:
    ```tsx
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground font-medium">Bóveda ABRN</span>
      <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
      {breadcrumbs.map((crumb, idx) => (
        <div key={crumb.id} className="flex items-center gap-1">
          <button
            onClick={() => onSelectFolder(crumb.id)}
            className="hover:text-foreground font-medium text-muted-foreground transition-colors"
          >
            {crumb.name}
          </button>
          {crumb.siblings && crumb.siblings.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label={`Jump to sibling folder of ${crumb.name}`}
                  className="p-1 rounded hover:bg-primary/10 text-muted-foreground/70 hover:text-foreground transition-colors"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[180px] py-1 bg-card/95 backdrop-blur-md">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {t("drive:nav.siblingFolders")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {crumb.siblings.map((sibling) => (
                  <DropdownMenuItem
                    key={sibling.id}
                    onClick={() => onSelectFolder(sibling.id)}
                    className={cn(
                      "cursor-pointer flex items-center gap-2",
                      sibling.id === crumb.id && "font-semibold text-primary"
                    )}
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>{sibling.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {idx < breadcrumbs.length - 1 && (
            <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
          )}
        </div>
      ))}
    </div>
    ```

### 2. Rich Origin Provenance Hover Cards (`src/components/vault/OriginBadge.tsx`)
* **Delayed Hover Card Engine**:
  - Delay open by 250ms (`openDelay={250}`) to prevent visual noise during casual cursor movement.
  - Floating card renders in hardware-accelerated portal:
    - **Header**: Intake Channel (e.g. `Drop Seguro: RG Consulting` or `Bóveda Personal`).
    - **Metadata Grid**:
      - Remitente / Remitter: Nombre o identificador cifrado.
      - Hora de Recepción / Ingest Time: Formato ISO + relativo (`Hace 5 días (Sep 11, 2026, 14:22 GMT-6)`).
      - Estado Criptográfico: Sello AES-256-GCM verificado, entrega de llave revocada tras custodia.
    - **Direct Action**: Enlace rápido `Ver Pasaporte Completo (P)`.
* **Visual Styling**:
  - Semi-translucent obsidian card: `w-72 p-3 bg-card/95 backdrop-blur-xl border border-primary/20 shadow-2xl rounded-xl space-y-2 text-xs`.

---

## Verification Plan

1. **Unit Tests (`OriginBadge.test.tsx`, `files.test.tsx`)**:
   - Verify breadcrumb renders sibling folders in dropdown.
   - Verify selecting sibling dispatches `onSelectFolder(siblingId)`.
   - Verify hover card renders delivery metadata for Drop intake badges.
2. **Visual & Usability Proof**:
   - Hover over `Drop: RG Consulting`: verify provenance card pops smoothly.
   - Click breadcrumb chevron: verify sibling folders list open and allow lateral jump.

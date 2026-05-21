# Step 2: Translation Files Scaffold

**Objective:** Establish the directory structure for translation keys and create the initial English and Spanish files.

## Action Plan

### 1. Directory Structure
Create the following structure in `vaultdrive_client/src/locales/`:
```text
locales/
  ├── en/
  │   ├── common.json     (Buttons, dates, generic errors)
  │   ├── auth.json       (Login, register, forgot password)
  │   ├── drive.json      (File explorer, folders, context menus)
  │   ├── settings.json   (Profile, security, preferences)
  └── es/
      ├── common.json
      ├── auth.json
      ├── drive.json
      ├── settings.json
```

### 2. English (Source of Truth) Population
Populate the English files first. They act as the master schema.
Example `en/common.json`:
```json
{
  "buttons": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "upload": "Upload"
  },
  "states": {
    "loading": "Loading...",
    "empty": "No data found."
  }
}
```

### 3. Mexican Spanish Translation (es-MX)
Translate the keys with a focus on Mexican localization context.
Example `es/common.json`:
```json
{
  "buttons": {
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "upload": "Subir"
  },
  "states": {
    "loading": "Cargando...",
    "empty": "No se encontraron datos."
  }
}
```

### 4. Type Safety for Keys (Optional but Recommended)
Set up a TypeScript definition for `react-i18next` so that `t('common:buttons.save')` is strongly typed and the IDE provides autocomplete. This prevents typos and missing keys.

## Verification
- Both `en` and `es` directories have exact structural parity.
- The app can successfully load both JSON dictionaries in development mode.

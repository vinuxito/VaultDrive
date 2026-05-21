# Step 3: Shell, Auth, and Navigation

**Objective:** Apply translations to the app's outermost shell, which includes the Authentication flow (Login/Register), the Sidebar Navigation, and the Top Header.

## Action Plan

### 1. Translate the Auth Flow
Extract hardcoded text from the Login, Registration, and Forgot Password components.
- Replace strings with `t('auth:login.title')`, `t('auth:login.email_placeholder')`, `t('auth:login.submit_btn')`, etc.
- Map error messages returned from form validation libraries (like Zod or Formik) to translation keys (e.g., "Email is required" -> `t('auth:errors.email_required')`).

### 2. Translate the App Shell & Navigation
The sidebar contains the main entry points for the user.
- Translate items like "My Drive", "Shared with Me", "Recent", "Trash".
- Ensure that the icons align well with potentially longer text in Spanish (e.g., "Compartidos conmigo").
- If the layout uses flex or grid, verify that longer text truncates nicely (with ellipses `...` and a tooltip) or wraps without breaking the sidebar width.

### 3. Translate the Top Header
- Translate search bar placeholders: "Search in QuantiX-Drive" -> "Buscar en QuantiX-Drive".
- Translate user menu dropdown items (Profile, Settings, Log out -> Perfil, Configuración, Cerrar sesión).

## Verification
- Load the `/login` route in Spanish mode and verify all text and placeholders are localized.
- Log in and inspect the sidebar and top header. Check for text overflow issues on smaller screen widths.

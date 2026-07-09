import { useNavigate } from "react-router-dom";

/**
 * A custom hook that wraps useNavigate with the native browser View Transitions API
 * to transition route changes smoothly.
 */
export function useTransitionNavigate() {
  const navigate = useNavigate();

  return (to: string, options?: { replace?: boolean; state?: any }) => {
    const doc = document as any;
    if (doc.startViewTransition) {
      try {
        doc.startViewTransition(() => {
          navigate(to, options);
        });
      } catch (err) {
        console.warn("View transition failed, falling back to standard navigation:", err);
        navigate(to, options);
      }
    } else {
      navigate(to, options);
    }
  };
}
